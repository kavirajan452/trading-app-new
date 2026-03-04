import json
import logging
from dataclasses import dataclass
import httpx
from app.config.settings import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


@dataclass
class AIAnalysis:
    score: float
    confidence: str
    reason: str


class GroqScorer:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL

    async def analyze_signal(
        self,
        symbol: str,
        scanner_score: float,
        features: dict,
    ) -> AIAnalysis:
        """
        Ask Groq to analyse a trading signal and return a score 0-100,
        confidence level and a brief reason.
        """
        prompt = self._build_prompt(symbol, scanner_score, features)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are a professional equity trader. "
                                    "Analyse the provided trading signal features and respond ONLY with valid JSON "
                                    'matching the schema: {"score": <0-100>, "reason": "<short reason>"}. '
                                    "score must be a number between 0 and 100."
                                ),
                            },
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.2,
                        "max_tokens": 256,
                    },
                )
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"].strip()
                parsed = json.loads(content)
                score = float(parsed.get("score", 50))
                reason = str(parsed.get("reason", ""))
        except Exception as exc:
            logger.warning("GroqScorer failed for %s: %s", symbol, exc)
            score = scanner_score
            reason = "AI analysis unavailable; using rule score"

        if score >= 75:
            confidence = "HIGH"
        elif score >= 60:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        return AIAnalysis(score=round(score, 2), confidence=confidence, reason=reason)

    def _build_prompt(self, symbol: str, scanner_score: float, features: dict) -> str:
        return (
            f"Symbol: {symbol}\n"
            f"Rule-based scanner score: {scanner_score}/100\n"
            f"Signal features:\n{json.dumps(features, indent=2)}\n\n"
            "Based on these features, provide an AI trading score (0-100) and a short reason."
        )
