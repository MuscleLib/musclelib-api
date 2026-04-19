# MuscleLib API

![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg) ![Version](https://img.shields.io/badge/version-1.1.3-orange.svg) ![Node.js](https://img.shields.io/badge/node.js-%3E%3D20%20%3C23-green.svg) ![MongoDB](https://img.shields.io/badge/database-MongoDB-success.svg)

## About

**MuscleLib API** is a robust RESTful API for searching and listing exercises. Built with **Node.js** and **Express.js**, it uses **MongoDB** as a database and offers support for multiple languages (Portuguese and English) with advanced pagination.

The API is optimized to provide fast and flexible searches through the **Fuse.js** library, allowing you to find exercises by name, physical characteristics, and categories with high precision.

## Features

- **Exercise Listing** - Returns exercises with configurable pagination
- **Intelligent Search** - Fuzzy search with Fuse.js for relevant results
- **Multi-language** - Native support for PT-BR and EN
- **Advanced Filters** - Filter by force, level, equipment, target muscle, and category
- **Field Selection** - Choose which fields to return (reduces payload)
- **Exercise Images** - Access to high-quality images
- **Language Detection** - Automatically uses `Accept-Language` header

## Installation

### Prerequisites
- Node.js `>= 20 < 23`
- MongoDB running locally or remote
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/MuscleLib/musclelib-api.git
cd musclelib-api

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start the server
npm start

# Or in development mode with hot-reload
npm run dev
```

## API Endpoints

### List Exercises
```http
GET /api/exercises
```

**Query Parameters:**
- `lang` (optional) - Language: `en` or `pt` (default: detects from `Accept-Language` header)
- `page` (optional) - Page number (default: 0)
- `limit` (optional) - Items per page (default: 20)
- `fields` (optional) - Fields to return: `name,force,level,mechanic,equipment,primaryMuscles,secondaryMuscles,category,images`
- `force` - Filter by force type (e.g., `push`, `pull`)
- `level` - Filter by level (e.g., `beginner`, `intermediate`, `advanced`)
- `equipment` - Filter by equipment
- `category` - Filter by category

**Example:**
```bash
curl "http://localhost:3000/api/exercises?lang=en&page=0&limit=10&force=push"
```

**Response (200 OK):**
```json
[
  {
    "id": "3041",
    "name": "Barbell Curl",
    "force": "Pull",
    "level": "Beginner",
    "mechanic": "Compound",
    "equipment": "Barbell",
    "primaryMuscles": ["Biceps"],
    "secondaryMuscles": ["Forearms"],
    "instructions": [
      "Position feet shoulder-width apart",
      "Grip the bar with hands shoulder-width apart..."
    ],
    "category": "Barbell",
    "images": ["url1.jpg", "url2.jpg"]
  }
]
```

### Search Exercises
```http
GET /api/exercises/search?query={term}
```

**Query Parameters:**
- `query` (required) - Search term
- `lang` (optional) - Language (default: `Accept-Language` header)
- `fields` (optional) - Fields to return

**Example:**
```bash
curl "http://localhost:3000/api/exercises/search?query=squat&lang=en"
```

**Response (200 OK):**
```json
{
  "exercises": [
    {
      "id": "123",
      "name": "Barbell Back Squat",
      "force": "Push",
      "level": "Intermediate",
      "primaryMuscles": ["Quadriceps"],
      "images": ["url1.jpg"]
    }
  ]
}
```

### Get Exercise Image
```http
GET /api/exercises/{exerciseName}/{imageIndex}.jpg
```

**Example:**
```bash
curl "http://localhost:3000/api/exercises/barbell-back-squat/0.jpg" -o image.jpg
```

## Data Model

```javascript
{
  "id": String,                              // Unique exercise ID
  "name": {
    "en": String,                            // Name in English
    "pt": String                             // Name in Portuguese
  },
  "force": {
    "en": String,                            // Force type (Push/Pull/Static)
    "pt": String
  },
  "level": {
    "en": String,                            // Level (Beginner/Intermediate/Expert)
    "pt": String
  },
  "mechanic": {
    "en": String,                            // Mechanic (Compound/Isolation)
    "pt": String
  },
  "equipment": {
    "en": String,                            // Required equipment
    "pt": String
  },
  "primaryMuscles": {
    "en": [String],                          // Primary muscles
    "pt": [String]
  },
  "secondaryMuscles": {
    "en": [String],                          // Secondary muscles
    "pt": [String]
  },
  "instructions": {
    "en": [String],                          // Step-by-step instructions
    "pt": [String]
  },
  "category": {
    "en": String,                            // Category (Barbell/Dumbbell/etc)
    "pt": String
  },
  "images": [String]                         // Array of image URLs
}
```

## Technologies Used

![Express.js](https://img.shields.io/badge/Express.js-5.2.1-90c53f?style=flat-square&logo=express)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Latest-13aa52?style=flat-square&logo=mongodb)
![Mongoose](https://img.shields.io/badge/Mongoose-9.1.6-880000?style=flat-square&logo=mongoose)
![Fuse.js](https://img.shields.io/badge/Fuse.js-7.1.0-3b3b3b?style=flat-square)
![Jest](https://img.shields.io/badge/Jest-30.3.0-15c213?style=flat-square&logo=jest)
![Swagger](https://img.shields.io/badge/Swagger%20UI-5.0.1-85ea2d?style=flat-square&logo=swagger)
![Prettier](https://img.shields.io/badge/Prettier-3.8.1-f7b93d?style=flat-square&logo=prettier)
![ESLint](https://img.shields.io/badge/ESLint-9.39.2-4b32c3?style=flat-square&logo=eslint)

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

## Issues

We track bugs, feature requests, and general improvements using GitHub Issues. 

- [View Open Issues](https://github.com/MuscleLib/musclelib-api/issues)
- [Create a New Issue](https://github.com/MuscleLib/musclelib-api/issues/new)

When reporting an issue, please include:
- A clear and descriptive title
- A detailed description of the problem or feature request
- Steps to reproduce the issue (if applicable)
- Expected and actual behavior
- Screenshots or error logs (if applicable)
- Your environment details (OS, Node version, etc.)

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Contributors

<a href="https://github.com/Programador-jr">
  <img src="https://avatars.githubusercontent.com/u/70107167?v=4&s=100" alt="Programador-jr" width="50" height="50" style="border-radius: 50%;" />
</a>

<a href="https://github.com/francogrion">
  <img src="https://avatars.githubusercontent.com/u/47388358?v=4&s=100" alt="francogrion" width="50" height="50" style="border-radius: 50%;" />
</a>

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.