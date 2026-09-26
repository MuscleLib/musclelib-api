require("dotenv").config();

const mongoose = require("mongoose");
const Exercise = require("../api/Exercise");
const Translation = require("../api/Translation");

// Spanish source: 0x10-z/free-exercise-db-es (derived from free-exercise-db).
const SOURCE_URL =
  "https://raw.githubusercontent.com/0x10-z/free-exercise-db-es/main/dist/exercises_es.json";

const TRANSLATION_FIELDS = [
  ["force", "force_translations"],
  ["level", "level_translations"],
  ["mechanic", "mechanic_translations"],
  ["equipment", "equipment_translations"],
  ["category", "category_translations"],
];

const addTranslation = (maps, collection, key, value, conflicts) => {
  if (!key || !value) return;

  const map = maps[collection] || new Map();
  const previous = map.get(key);

  if (previous && previous !== value) {
    conflicts.push({ collection, key, previous, value });
    return;
  }

  map.set(key, value);
  maps[collection] = map;
};

const run = async () => {
  const dryRun = process.argv.includes("--dry-run");

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download Spanish dataset: HTTP ${response.status}`);
  }

  const spanishExercises = await response.json();
  if (!Array.isArray(spanishExercises) || spanishExercises.length === 0) {
    throw new Error("Spanish dataset is empty or invalid.");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_NAME,
  });

  const exercises = await Exercise.find({}).lean();
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const translationMaps = {};
  const conflicts = [];
  const exerciseUpdates = [];
  let missingExercises = 0;

  for (const spanish of spanishExercises) {
    const exercise = byId.get(spanish.id);

    if (!exercise) {
      missingExercises += 1;
      continue;
    }

    exerciseUpdates.push({
      updateOne: {
        filter: { id: spanish.id },
        update: {
          $set: {
            "name.es": spanish.name,
            "instructions.es": spanish.instructions || [],
          },
        },
      },
    });

    for (const [field, collection] of TRANSLATION_FIELDS) {
      const slug = exercise[field];
      const value = spanish[field];

      if (slug && value) {
        addTranslation(translationMaps, collection, slug, value, conflicts);
      }
    }

    for (const field of ["primaryMuscles", "secondaryMuscles"]) {
      const slugs = Array.isArray(exercise[field]) ? exercise[field] : [];
      const values = Array.isArray(spanish[field]) ? spanish[field] : [];

      slugs.forEach((slug, index) => {
        addTranslation(
          translationMaps,
          "muscle_translations",
          slug,
          values[index],
          conflicts,
        );
      });
    }
  }

  if (dryRun) {
    console.log(`Spanish source exercises: ${spanishExercises.length}`);
    console.log(`Database exercises: ${exercises.length}`);
    console.log(`Exercise translations to update: ${exerciseUpdates.length}`);
    console.log(`Missing exercise IDs: ${missingExercises}`);

    for (const [collection, map] of Object.entries(translationMaps)) {
      console.log(`${collection}: ${map.size} Spanish translations`);
    }

    if (conflicts.length > 0) {
      console.warn(`Translation conflicts: ${conflicts.length}`);
      console.warn(JSON.stringify(conflicts.slice(0, 20), null, 2));
    }

    return;
  }

  const exerciseResult =
    exerciseUpdates.length > 0
      ? await Exercise.bulkWrite(exerciseUpdates, { ordered: false })
      : null;

  for (const [collection, map] of Object.entries(translationMaps)) {
    const model = Translation(collection);
    const operations = [...map.entries()].map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $set: { "translations.es": value } },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await model.bulkWrite(operations, { ordered: false });
    }
  }

  console.log("Spanish translations imported successfully.");
  console.log(`Source exercises: ${spanishExercises.length}`);
  console.log(`Updated exercises: ${exerciseResult?.modifiedCount || 0}`);
  console.log(`Missing exercise IDs: ${missingExercises}`);

  for (const [collection, map] of Object.entries(translationMaps)) {
    console.log(`${collection}: ${map.size} translations`);
  }

  if (conflicts.length > 0) {
    console.warn(`Translation conflicts skipped: ${conflicts.length}`);
    console.warn(JSON.stringify(conflicts.slice(0, 20), null, 2));
  }
};

run()
  .catch((error) => {
    console.error("Spanish translation import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
