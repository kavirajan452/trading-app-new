from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from app.database.models import Prediction, PredictionStatus


EVALUATION_TIMEFRAMES = [5, 15, 30, "EOD"]


class PredictionEngine:
    def store_prediction(
        self,
        db: Session,
        symbol: str,
        entry_price: float,
        rule_score: float,
        ai_score: float | None,
        ai_reason: str | None,
        features: dict[str, Any] | None = None,
    ) -> Prediction:
        """Persist a new prediction and return the ORM object."""
        prediction = Prediction(
            stock_symbol=symbol,
            timestamp=datetime.now(timezone.utc),
            entry_price=entry_price,
            rule_score=rule_score,
            ai_score=ai_score,
            ai_reason=ai_reason,
            features=features or {},
            status=PredictionStatus.PENDING,
        )
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        return prediction

    def get_pending_predictions(self, db: Session) -> list[Prediction]:
        """Return all predictions that have not yet been fully evaluated."""
        return (
            db.query(Prediction)
            .filter(Prediction.status == PredictionStatus.PENDING)
            .all()
        )

    def mark_evaluated(self, db: Session, prediction_id: int) -> None:
        """Mark a prediction as EVALUATED once all timeframes are assessed."""
        prediction = db.get(Prediction, prediction_id)
        if prediction:
            prediction.status = PredictionStatus.EVALUATED
            db.commit()
