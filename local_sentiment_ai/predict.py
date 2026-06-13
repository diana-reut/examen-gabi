from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "artifacts" / "sentiment_model.joblib"


def load_payload() -> list[str]:
    raw = sys.stdin.read().strip()
    if not raw:
        return []

    payload = json.loads(raw)
    texts = payload.get("texts", [])
    if not isinstance(texts, list):
        return []

    return [str(text) for text in texts]


def main() -> None:
    if not MODEL_PATH.exists():
        raise RuntimeError("Sentiment model artifact not found. Train the model first.")

    texts = load_payload()
    if not texts:
        print(json.dumps({"predictions": []}, ensure_ascii=True))
        return

    model = joblib.load(MODEL_PATH)
    labels = model.predict(texts).tolist()

    probabilities = None
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(texts).tolist()

    predictions = []
    for index, label in enumerate(labels):
        prediction = {"label": label}
        if probabilities is not None:
            prediction["confidence"] = round(max(probabilities[index]), 4)
        predictions.append(prediction)

    print(json.dumps({"predictions": predictions}, ensure_ascii=True))


if __name__ == "__main__":
    main()
