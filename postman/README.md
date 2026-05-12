# MuscleLib Postman Tests

This folder contains Postman resources for manually exploring and regression-testing the MuscleLib API.

## Collections

- `collections/musclelib-exercises-api/collection.yaml`  
  Existing workspace collection metadata for Postman Local View.

- `collections/musclelib-api-behavior-tests.postman_collection.json`  
  Importable Postman v2.1 collection with behavior tests for:
  - API health
  - exercise listing
  - language validation
  - field selection validation
  - pagination validation
  - filtering
  - search
  - image responses

## Environments

- `environments/local.postman_environment.json` uses `http://localhost:3000`.
- `environments/production.postman_environment.json` uses `https://libapi.vercel.app`.

Adjust environment variables such as `searchQueryEn`, `primaryMuscleEn`, and `imageExerciseId` if the database fixture changes.

## CLI Usage

If you have Newman installed:

```bash
newman run postman/collections/musclelib-api-behavior-tests.postman_collection.json \
  -e postman/environments/local.postman_environment.json
```

For production:

```bash
newman run postman/collections/musclelib-api-behavior-tests.postman_collection.json \
  -e postman/environments/production.postman_environment.json
```
