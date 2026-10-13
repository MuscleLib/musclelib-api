# MuscleLib API

![Version](https://img.shields.io/badge/version-2.1.0-orange.svg) ![Node.js](https://img.shields.io/badge/node.js-%3E%3D20%20%3C23-green.svg) ![License](https://img.shields.io/badge/license-MIT-blue.svg)

## About

**MuscleLib API** is a multilingual (English/Portuguese/Spanish) RESTful API for searching and listing fitness exercises. It provides fuzzy search, advanced filtering, pagination, field selection, and high-quality exercise images — all in a single API.

Built with **Node.js** and **Express.js**, the API uses **MongoDB** for storage and **Fuse.js** for intelligent search.

## How It Works

The API serves exercise data in three languages (`en`, `pt`, and `es`). Exercise names and instructions are stored in localized form, while shared attributes use translation collections — when you make a request, the API automatically localizes the response to your preferred language.

**Language detection priority:**
1. `lang` query parameter (`?lang=pt`)
2. `Accept-Language` HTTP header
3. Falls back to English (`en`)

Regional language tags such as `es-ES` and `pt-BR` are supported in `Accept-Language`. The API selects a supported language by quality (`q`) preference; an explicit `lang` takes priority.

Search uses **fuzzy matching** via Fuse.js, so you don't need exact spelling. Filters are validated against the actual values present in the database, and images are served directly from the filesystem.

## Features

- **Exercise Listing** — Paginated list with configurable page and limit
- **Fuzzy Search** — Typo-tolerant search via Fuse.js
- **Multilingual** — Native support for English, Portuguese (PT-BR), and Spanish
- **Advanced Filters** — Filter by force, level, mechanic, equipment, category, and muscles
- **Field Selection** — Request only the fields you need to reduce payload
- **Exercise Images** — Two high-quality images per exercise
- **Filter Options** — Discover available filter values via `/filters` endpoint
- **Health Check** — Simple `/api/ping` endpoint
- **Statistics** — Exercise and image count via `/stats`

## Base URL

```
https://musclelib-api.vercel.app
```

> All endpoints below use this base URL. Replace with `http://localhost:5000` for local development.

## API Endpoints

### Health Check

```http
GET /api/ping
```

**Response:** `pong` (200)

---

### List Exercises

```http
GET /api/exercises
```

Returns paginated exercises matching the applied filters.

Filters and pagination run in MongoDB; only the requested page is loaded for localization. Results are ordered by ascending MongoDB `_id` before pagination. Pages are zero-indexed, and an empty page (including one past the last matching exercise) returns the localized 404 response shown below. With `fields`, MongoDB fetches the requested fields plus `_id`, `id`, `name`, and `images` required for serialization and source-data recovery.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `lang` | `string` | `Accept-Language` or `"en"` | Language: `"en"`, `"pt"`, or `"es"` |
| `page` | `integer` | `0` | Page number (zero-indexed) |
| `limit` | `integer` | `50` | Items per page, from 1 to 100 |
| `fields` | `string` | all fields | Comma-separated fields to return |
| `force` | `string` | — | Filter by force type |
| `level` | `string` | — | Filter by level |
| `mechanic` | `string` | — | Filter by mechanic |
| `equipment` | `string` | — | Filter by equipment |
| `category` | `string` | — | Filter by category |
| `primaryMuscles` | `string` | — | Filter by primary muscle |
| `secondaryMuscles` | `string` | — | Filter by secondary muscle |
| `id` | `string` | — | Exact stored exercise ID |

The seven localized filters (`force`, `level`, `mechanic`, `equipment`, `category`, `primaryMuscles`, and `secondaryMuscles`) accept a single value in the selected language, as returned by `/api/exercises/filters`. A display label shared by multiple stored slugs matches all of them. Multiple filters are combined with AND; muscle filters match any element of the respective stored muscle array. Invalid localized values return HTTP 400 with `avaliableOptions`. `id` matches a single stored exercise ID exactly.

For compatibility with callers written before `mechanic` was localized, `mechanic` also accepts its stored slug in any language (for example, `?lang=pt&mechanic=compound`); the stored slugs are the English labels `compound` and `isolation`. A label in the selected language takes precedence over a slug. The other localized filters accept only labels in the selected language.

Only the parameters in the table above are accepted, and `id` may appear only once. Any other query parameter (including misspelled names such as `Force`, or operator-shaped keys such as `force[$ne]`) returns a localized HTTP 400 that lists the rejected names in `invalidParameters` and the accepted parameters in `message`. Arbitrary query fields or operators are never passed to MongoDB.

> **Behavior change:** previously, unknown query parameters (and a repeated `id`) returned HTTP 404 `No exercises found.`, and `mechanic` only matched its stored slug: localized labels such as `composto` and unknown values both returned 404. Unknown parameters now return HTTP 400 with `invalidParameters`; `mechanic` accepts localized labels, and unknown `mechanic` values return HTTP 400 with `avaliableOptions`. HTTP 404 is now reserved for valid requests with no matching exercises on the requested page.

The maximum `limit` is now **100**; larger values return a localized HTTP 400 error rather than being silently clamped. The `page` value and offset (`page * limit`) must fit within JavaScript's safe integer range (maximum `9007199254740991`). Excessive pages have a dedicated localized error, and excessive offsets report the maximum page allowed for the requested limit.

Valid `fields` values: `name`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions`, `category`, `images`.

Send field selection as one comma-separated parameter (for example, `fields=name,images`). Repeated `fields` parameters return a JSON validation error with HTTP 400 in both listing and search.

Likewise, send `page` and `limit` at most once each. A repeated `page` or `limit` (for example, `page=1&page=2`) returns the localized invalid `page` or `limit` error with HTTP 400; previously the first value was silently used.

**Example:**
```bash
curl "https://musclelib-api.vercel.app/api/exercises?lang=en&page=0&limit=5&force=pull"
```

**Response (200):**
```json
[
  {
    "_id": "677471841533c77a3a55b4ff",
    "id": "Barbell_Curl",
    "name": "Barbell Curl",
    "force": "pull",
    "level": "beginner",
    "mechanic": "isolation",
    "equipment": "barbell",
    "primaryMuscles": ["biceps"],
    "secondaryMuscles": ["forearms"],
    "instructions": [
      "Stand up straight with your feet shoulder-width apart...",
      "Curl the barbell up towards your chest..."
    ],
    "category": "strength",
    "images": ["Barbell_Curl/0.jpg", "Barbell_Curl/1.jpg"]
  }
]
```

**Response (404 — no results):**
```json
{
  "message": "No exercises found."
}
```

**Response (400 — unsupported query parameter):**
```bash
curl "https://musclelib-api.vercel.app/api/exercises?muscle=chest"
```
```json
{
  "message": "Invalid query parameter(s). Valid parameters are: lang, page, limit, fields, force, level, mechanic, equipment, category, primaryMuscles, secondaryMuscles, id.",
  "invalidParameters": ["muscle"]
}
```

---

### Search Exercises

```http
GET /api/exercises/search?query={term}
```

Performs a fuzzy search against exercise names.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `string` | **required** | Search term |
| `lang` | `string` | `Accept-Language` or `"en"` | Language |
| `fields` | `string` | all fields | Comma-separated fields to return |

**Example:**
```bash
curl "https://musclelib-api.vercel.app/api/exercises/search?query=squat&lang=en"
```

**Response (200):**
```json
{
  "exercises": [
    {
      "_id": "677471841533c77a3a55b4ff",
      "id": "Barbell_Back_Squat",
      "name": "Barbell Back Squat",
      "force": "push",
      "level": "intermediate",
      "primaryMuscles": ["quadriceps"],
      "images": ["Barbell_Back_Squat/0.jpg", "Barbell_Back_Squat/1.jpg"]
    }
  ]
}
```

**Response — when no translation exists for the selected language:**
```json
{
  "message": "Exercise not available in the selected language. Try: Barbell Back Squat"
}
```

---

### Get Filter Options

```http
GET /api/exercises/filters
```

Returns all available filter values aggregated from the database.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `lang` | `string` | `Accept-Language` or `"en"` | Language |

**Example:**
```bash
curl "https://musclelib-api.vercel.app/api/exercises/filters?lang=en"
```

**Response (200):**
```json
{
  "force": ["push", "pull", "static"],
  "level": ["beginner", "intermediate", "expert"],
  "mechanic": ["compound", "isolation"],
  "category": ["barbell", "dumbbell", "machine", "cables", "body only", ...],
  "equipment": ["barbell", "dumbbell", "body only", "cable", "ez-bar", ...],
  "primaryMuscles": ["biceps", "triceps", "quadriceps", "chest", "back", ...],
  "secondaryMuscles": ["forearms", "glutes", "hamstrings", "abs", ...]
}
```

---

### Get Exercise Image

```http
GET /api/exercises/{exerciseName}/{imageIndex}.jpg
```

Serves an exercise image directly. Each exercise has two images (`0.jpg` and `1.jpg`).

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `exerciseName` | `string` | Exercise ID (e.g., `Barbell_Curl`) |
| `imageIndex` | `integer` | `0` or `1` |

**Example:**
```bash
curl "https://musclelib-api.vercel.app/api/exercises/Barbell_Curl/0.jpg" -o image.jpg
```

**Response:** JPEG image (200) or JSON error (400).

---

### Statistics

```http
GET /stats
```

Returns total exercise and image counts.

**Example:**
```bash
curl "https://musclelib-api.vercel.app/stats"
```

**Response (200):**
```json
{
  "totalExercises": 1000,
  "totalImages": 2000
}
```

---

### Documentation

```http
GET /docs
```

Redirects to the external API documentation site.

## Integration Tests with MongoDB

The real-database list tests are opt-in and require a running test MongoDB server. They do not read the application's `.env`. In PowerShell:

```powershell
$env:MONGODB_TEST_URI = "mongodb://127.0.0.1:27017"
npm test -- --runInBand test/integration/exercises.list.mongodb.test.js
Remove-Item Env:MONGODB_TEST_URI
```

The suite creates a unique `musclelib_issue66_test_*` database, imports the repository's exercise catalog plus isolated edge-case fixtures and translation collections, and drops only that database during cleanup. It verifies actual MongoDB commands and transferred document counts, as well as combined localized filters (including every `mechanic` value advertised by `/filters`), rejected query parameters, pagination boundaries, field selection, and empty results. Without `MONGODB_TEST_URI`, the integration suite is skipped and the normal unit tests still run.

## Data Model

### Stored Format (MongoDB)

Exercise documents keep stable slugs for shared attributes and localized values for exercise-specific text:

```javascript
{
  "_id": ObjectId,
  "id": String,
  "name": {
    "en": String,
    "pt": String,
    "es": String
  },
  "force": String,
  "level": String,
  "mechanic": String,
  "equipment": String,
  "primaryMuscles": [String],
  "secondaryMuscles": [String],
  "instructions": {
    "en": [String],
    "pt": [String],
    "es": [String]
  },
  "category": String,
  "images": [String]
}
```

Shared values such as force, level, mechanic, equipment, category, and muscles are resolved through translation collections containing `en`, `pt`, and `es`.
### Serialized Response

When returned via the API, localized fields are flattened to the requested language:

```javascript
{
  "_id": String,           // MongoDB ObjectId
  "id": String,            // Unique exercise slug
  "name": String,          // Localized name
  "force": String,         // Localized force type
  "level": String,         // Localized level
  "mechanic": String,      // Localized mechanic type
  "equipment": String,     // Localized equipment
  "primaryMuscles": [String],
  "secondaryMuscles": [String],
  "instructions": [String],
  "category": String,
  "images": [String]       // Image paths
}
```

