import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database.models import PredictionOutcome, OutcomeResult, Prediction

logger = logging.getLogger(__name__)

WIN_THRESHOLD = 0.005   # 0.5 % favourable move
LOSS_THRESHOLD = -0.005  # 0.5 % adverse move


class OutcomeEvaluator:
    def evaluate_prediction(
        self,
        db: Session,
        prediction_id: int,
        current_price: float,
        timeframe: str,
        mfe: float | None = None,
        mae: float | None = None,
    ) -> PredictionOutcome:
        """
        Evaluate a prediction at a given timeframe.

        WIN  : price moved > +0.5 % from entry
        LOSS : price moved < -0.5 % from entry
        NEUTRAL: otherwise
        """
        prediction: Prediction | None = db.get(Prediction, prediction_id)
        if prediction is None:
            raise ValueError(f"Prediction {prediction_id} not found")

        entry = prediction.entry_price
        if entry == 0:
            raise ValueError("Entry price is zero; cannot evaluate")

        pct_change = (current_price - entry) / entry

        if pct_change > WIN_THRESHOLD:
            result = OutcomeResult.WIN
        elif pct_change < LOSS_THRESHOLD:
            result = OutcomeResult.LOSS
        else:
            result = OutcomeResult.NEUTRAL

        outcome = PredictionOutcome(
            prediction_id=prediction_id,
            evaluated_at=datetime.now(timezone.utc),
            timeframe=str(timeframe),
            exit_price=current_price,
            mfe=mfe,
            mae=mae,
            result=result,
        )
        db.add(outcome)
        try:
            db.commit()
            db.refresh(outcome)
        except Exception as exc:
            db.rollback()
            logger.error("Failed to save outcome for prediction %s: %s", prediction_id, exc)
            raise
        return outcome
