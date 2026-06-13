from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, UTC
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "data" / "comments_sentiment_dataset.csv"
ARTIFACTS_DIR = ROOT / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "sentiment_model.joblib"
METADATA_PATH = ARTIFACTS_DIR / "metadata.json"


def load_dataset() -> tuple[list[str], list[str]]:
    texts: list[str] = []
    labels: list[str] = []

    with DATASET_PATH.open("r", encoding="utf-8", newline="") as handle:
      reader = csv.DictReader(handle)
      for row in reader:
          text = str(row.get("text", "")).strip()
          label = str(row.get("label", "")).strip().lower()
          if text and label:
              texts.append(text)
              labels.append(label)

    if not texts:
        raise RuntimeError("Training dataset is empty.")

    return texts, labels


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    strip_accents="unicode",
                    ngram_range=(1, 2),
                    min_df=1,
                    max_df=0.95,
                    sublinear_tf=True,
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )


def main() -> None:
    texts, labels = load_dataset()
    pipeline = build_pipeline()
    pipeline.fit(texts, labels)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)

    metadata = {
        "trained_at": datetime.now(UTC).isoformat(),
        "dataset_path": str(DATASET_PATH),
        "sample_count": len(texts),
        "label_distribution": Counter(labels),
        "labels": sorted(set(labels)),
        "model_path": str(MODEL_PATH),
    }

    with METADATA_PATH.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=True, indent=2)

    print(json.dumps(metadata, ensure_ascii=True))


if __name__ == "__main__":
    main()
