# Local Sentiment AI

This folder contains a sentiment analysis model that is trained locally and does not depend on an external AI service.

## Approach

- `TfidfVectorizer`
- `LogisticRegression`
- locally curated labeled dataset in `data/comments_sentiment_dataset.csv`

## Files

- `data/comments_sentiment_dataset.csv`: training data
- `train_model.py`: trains the model locally
- `predict.py`: loads the trained model and predicts sentiment for comment texts
- `requirements.txt`: Python dependencies
- `artifacts/`: generated model files

## Train locally

```powershell
cd "D:\gabi examen\local_sentiment_ai"
python train_model.py
```

## Predict manually

```powershell
echo {"texts":["Foarte bun articol","Nu mi-a placut deloc"]} | python predict.py
```

## Labels

- `positive`
- `neutral`
- `negative`
