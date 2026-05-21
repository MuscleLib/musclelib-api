# MuscleLib API

![Version](https://img.shields.io/badge/version-2.1.0-orange.svg) ![Node.js](https://img.shields.io/badge/node.js-%3E%3D20%20%3C23-green.svg) ![License](https://img.shields.io/badge/license-MIT-blue.svg)

## About

**MuscleLib API** is a bilingual (English/Portuguese) RESTful API for searching and listing fitness exercises. It provides fuzzy search, advanced filtering, pagination, field selection, and high-quality exercise images — all in a single API.

Built with **Node.js** and **Express.js**, the API uses **MongoDB** for storage and **Fuse.js** for intelligent search.

## How It Works

The API serves exercise data in two languages (`en` and `pt`). Every exercise has a bilingual data structure — when you make a request, the API automatically localizes the response to your preferred language.

**Language detection priority:**
1. `lang` query parameter (`?lang=pt`)
2. `Accept-Language` HTTP header
3. Falls back to English (`en`)

Search uses **fuzzy matching** via Fuse.js, so you don't need exact spelling. Filters are validated against the actual values present in the database, and images are served directly from the filesystem.

## Features

- **Exercise Listing** — Paginated list with configurable page and limit
- **Fuzzy Search** — Typo-tolerant search via Fuse.js
- **Bilingual** — Native support for English and Portuguese (PT-BR)
- **Advanced Filters** — Filter by force, level, equipment, category, and muscles
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

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `lang` | `string` | `Accept-Language` or `"en"` | Language: `"en"` or `"pt"` |
| `page` | `integer` | `0` | Page number (zero-indexed) |
| `limit` | `integer` | `50` | Items per page |
| `fields` | `string` | all fields | Comma-separated fields to return |
| `force` | `string` | — | Filter by force type |
| `level` | `string` | — | Filter by level |
| `equipment` | `string` | — | Filter by equipment |
| `category` | `string` | — | Filter by category |
| `primaryMuscles` | `string` | — | Filter by primary muscle |
| `secondaryMuscles` | `string` | — | Filter by secondary muscle |

Valid `fields` values: `name`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions`, `category`, `images`.

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

## Data Model

### Stored Format (MongoDB)

```javascript
{
  "_id": ObjectId,                     // Auto-generated
  "id": String,                        // Unique slug (e.g. "Barbell_Curl")
  "name": {
    "en": String,                      // Name in English
    "pt": String                       // Name in Portuguese
  },
  "force":         { "en": String, "pt": String },
  "level":         { "en": String, "pt": String },
  "mechanic":      { "en": String, "pt": String },
  "equipment":     { "en": String, "pt": String },
  "primaryMuscles":   { "en": [String], "pt": [String] },
  "secondaryMuscles": { "en": [String], "pt": [String] },
  "instructions":  { "en": [String], "pt": [String] },
  "category":      { "en": String, "pt": String },
  "images": [String]                   // e.g. ["Barbell_Curl/0.jpg", "Barbell_Curl/1.jpg"]
}
```

### Serialized Response

When returned via the API, bilingual fields are flattened to the requested language:

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

## Error Handling

All error responses follow a consistent JSON structure:

```json
{
  "message": "Error description in the requested language"
}
```

**Common HTTP Status Codes:**

| Status | Meaning |
|---|---|
| `200` | Success |
| `400` | Invalid parameters (language, fields, pagination, filter values) |
| `404` | No exercises found matching the criteria |
| `500` | Internal server error |

**Bilingual error messages** — all messages are returned in the language detected from your request.

## Technologies Used

![Express.js](https://img.shields.io/badge/Express.js-5.2.1-90c53f?style=flat-square&logo=express)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20%20%3C23-339933?style=flat-square&logo=node.js)
![Mongoose](https://img.shields.io/badge/Mongoose-9.6.2-880000?style=flat-square&logo=mongoose)
![Fuse.js](https://img.shields.io/badge/Fuse.js-7.3.0-3b3b3b?style=flat-square)
![Jest](https://img.shields.io/badge/Jest-30.4.2-15c213?style=flat-square&logo=jest)
![ESLint](https://img.shields.io/badge/ESLint-10.4.0-4b32c3?style=flat-square&logo=eslint)
![Prettier](https://img.shields.io/badge/Prettier-3.8.3-f7b93d?style=flat-square&logo=prettier)

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Available Scripts

```bash
npm start        # Start the server in production
npm run dev      # Start in development mode with hot-reload
npm test         # Run tests with Jest
npm run lint     # Validate code with ESLint
npm run format   # Format code with Prettier
```

## Contributors

<a href="https://github.com/Programador-jr">
  <img src="https://avatars.githubusercontent.com/u/70107167?v=4&s=100" alt="Programador-jr" width="50" height="50" style="border-radius: 50%;" />
</a>

<a href="https://github.com/francogrion">
  <img src="https://avatars.githubusercontent.com/u/47388358?v=4&s=100" alt="francogrion" width="50" height="50" style="border-radius: 50%;" />
</a>

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.