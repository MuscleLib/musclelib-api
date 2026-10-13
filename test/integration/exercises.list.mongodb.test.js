const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const Exercise = require("../../api/Exercise");
const routes = require("../../api/exerciseRoutes");
const { getTranslations, resetCache } = require("../../api/translationCache");
const { errorMessages } = require("../../api/routes/exercises/shared");

// Opt in with a test server URI. Never use the application's .env connection.
const describeMongoDB = process.env.MONGODB_TEST_URI ? describe : describe.skip;
const testDatabaseName = `musclelib_issue66_test_${process.pid}_${Date.now()}`;
const fieldCollections = {
  force: "force_translations",
  level: "level_translations",
  mechanic: "mechanic_translations",
  equipment: "equipment_translations",
  category: "category_translations",
  primaryMuscles: "muscle_translations",
  secondaryMuscles: "muscle_translations",
};
// Keep these test fixture slugs aligned with toSlug in
// scripts/migrate-exercises-to-slugs.js and normalizeKey in scripts/seed-translations.js.
const toSlug = (value) =>
  typeof value === "string"
    ? value.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "")
    : null;
const labels = {
  push: { en: "push", pt: "empurrar", es: "empujar" },
  expert: { en: "expert", pt: "avancado", es: "experto" },
  strength: { en: "strength", pt: "forca", es: "fuerza" },
  chest: { en: "chest", pt: "peito", es: "pecho" },
  shoulders: { en: "shoulders", pt: "ombros", es: "hombros" },
  triceps: { en: "triceps", pt: "triceps", es: "tríceps" },
  issue66_fixture: {
    en: "test equipment",
    pt: "equipamento de teste",
    es: "equipo de prueba",
  },
};
const combinedFilters = {
  force: "push",
  level: "expert",
  equipment: "issue66_fixture",
  category: "strength",
  primaryMuscles: "chest",
  secondaryMuscles: "triceps",
};
const mongoFilters = Object.fromEntries(
  Object.entries(combinedFilters).map(([field, slug]) => [
    field,
    { $in: [slug] },
  ]),
);
const collisionSlugs = ["issue66_collision_a", "issue66_collision_b"];
const collisionLabels = {
  en: "shared label",
  pt: "rotulo compartilhado",
  es: "etiqueta compartida",
};

describeMongoDB("exercise list against real MongoDB", () => {
  const app = express();
  app.use("/api/exercises", routes);
  let documents;
  let catalogCount;
  let commands = [];
  let transferredDocuments = 0;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI, {
      dbName: testDatabaseName,
      monitorCommands: true,
      serverSelectionTimeoutMS: 10000,
    });
    const db = mongoose.connection.db;
    const version = await db.admin().command({ buildInfo: 1 });
    const client = mongoose.connection.getClient();
    client.on("commandStarted", (event) => {
      if (event.commandName === "find" && event.command.find === "exercises") {
        commands.push({
          ...event.command,
          // The MongoDB driver represents BSON sort documents as Map objects.
          sort:
            event.command.sort instanceof Map
              ? Object.fromEntries(event.command.sort)
              : event.command.sort,
        });
      }
    });
    client.on("commandSucceeded", (event) => {
      const cursor = event.reply.cursor;
      if (cursor?.ns === `${testDatabaseName}.exercises`) {
        transferredDocuments += (cursor.firstBatch || cursor.nextBatch || [])
          .length;
      }
    });

    const translationDocuments = {};
    const registerTranslation = (collection, rawValue) => {
      const key = toSlug(rawValue);
      if (!key) return key;
      translationDocuments[collection] ||= new Map();
      translationDocuments[collection].set(key, {
        key,
        translations: labels[key] || {
          en: rawValue,
          pt: rawValue,
          es: rawValue,
        },
      });
      return key;
    };
    const catalogPath = path.resolve(__dirname, "../../exercises");
    documents = fs
      .readdirSync(catalogPath)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => {
        const source = JSON.parse(
          fs.readFileSync(path.join(catalogPath, file), "utf8"),
        );
        const document = {
          ...source,
          name: { en: source.name, pt: source.name, es: source.name },
          instructions: {
            en: source.instructions,
            pt: source.instructions,
            es: source.instructions,
          },
        };
        for (const [field, collection] of Object.entries(fieldCollections)) {
          document[field] = Array.isArray(source[field])
            ? source[field]
                .map((value) => registerTranslation(collection, value))
                .filter(Boolean)
            : registerTranslation(collection, source[field]);
        }
        return document;
      });
    catalogCount = documents.length;
    registerTranslation("equipment_translations", "issue66_fixture");
    // Re-register with the real localized display labels for the test-only slug.
    translationDocuments.equipment_translations.set("issue66_fixture", {
      key: "issue66_fixture",
      translations: labels.issue66_fixture,
    });
    const buildMatchingDocument = (index) => ({
      id: `Issue66_Match_${index}`,
      name: {
        en: `Integration exercise ${index}`,
        pt: `Exercicio de integracao ${index}`,
        es: `Ejercicio de integración ${index}`,
      },
      instructions: {
        en: ["Test instruction"],
        pt: ["Instrucao de teste"],
        es: ["Instrucción de prueba"],
      },
      force: "push",
      level: "expert",
      equipment: "issue66_fixture",
      category: "strength",
      mechanic: "compound",
      primaryMuscles: ["shoulders", "chest"],
      secondaryMuscles: ["shoulders", "triceps"],
      images: [`Issue66_Match_${index}/0.jpg`],
    });
    const matches = Array.from({ length: 5 }, (_, index) =>
      buildMatchingDocument(index),
    );
    const distractors = Object.keys(combinedFilters).map((field, index) => ({
      ...buildMatchingDocument(index),
      id: `Issue66_Distractor_${field}`,
      [field]: field.endsWith("Muscles") ? [] : null,
    }));
    const collisions = collisionSlugs.map((slug, index) => ({
      ...buildMatchingDocument(index),
      id: `Issue66_Collision_${index}`,
      equipment: slug,
      primaryMuscles: [slug],
      secondaryMuscles: [slug],
    }));
    for (const collection of [
      "equipment_translations",
      "muscle_translations",
    ]) {
      for (const key of collisionSlugs) {
        translationDocuments[collection].set(key, {
          key,
          translations: collisionLabels,
        });
      }
    }
    documents.push(...matches, ...distractors, ...collisions);
    documents = documents.map((document, index) => ({
      ...document,
      _id: new mongoose.Types.ObjectId(
        (index + 1).toString(16).padStart(24, "0"),
      ),
    }));
    // Deliberately insert in reverse _id order so natural order cannot satisfy the tests.
    await Exercise.collection.insertMany([...documents].reverse());
    for (const [collection, values] of Object.entries(translationDocuments)) {
      await db.collection(collection).insertMany([...values.values()]);
    }
    resetCache();
    await getTranslations();
    console.info(
      `Real MongoDB ${version.version}: ${catalogCount} catalog exercises + ${matches.length + distractors.length + collisions.length} edge-case fixtures`,
    );
  }, 30000);

  beforeEach(() => {
    commands = [];
    transferredDocuments = 0;
  });

  afterAll(async () => {
    try {
      // Drop only the unique database created by this suite, never a URI's database.
      if (
        mongoose.connection.readyState === 1 &&
        mongoose.connection.name === testDatabaseName
      ) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      resetCache();
      await mongoose.disconnect();
    }
  });

  it("loads only the requested page over the MongoDB wire protocol", async () => {
    const response = await request(app).get("/api/exercises?page=2&limit=3");
    expect(response.status).toBe(200);
    expect(response.body.map((exercise) => exercise.id)).toEqual(
      documents.slice(6, 9).map((exercise) => exercise.id),
    );
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      filter: {},
      sort: { _id: 1 },
      skip: 6,
      limit: 3,
    });
    expect(transferredDocuments).toBe(3);
  });

  it("uses the default limit against the full real catalog", async () => {
    const response = await request(app).get("/api/exercises");
    expect(response.status).toBe(200);
    expect(response.body.map((exercise) => exercise.id)).toEqual(
      documents.slice(0, 50).map((exercise) => exercise.id),
    );
    expect(transferredDocuments).toBe(50);
    expect(commands[0].limit).toBe(50);
    expect(catalogCount).toBeGreaterThan(800);
  });

  it.each(["en", "pt", "es"])(
    "applies all six filters as AND, including array membership, in %s",
    async (lang) => {
      for (const [page, expectedIds] of [
        [0, ["Issue66_Match_0", "Issue66_Match_1"]],
        [1, ["Issue66_Match_2", "Issue66_Match_3"]],
        [2, ["Issue66_Match_4"]],
      ]) {
        const params = Object.fromEntries(
          Object.entries(combinedFilters).map(([field, slug]) => [
            field,
            labels[slug][lang],
          ]),
        );
        commands = [];
        transferredDocuments = 0;
        const response = await request(app)
          .get("/api/exercises")
          .query({ ...params, lang, page, limit: 2 });
        expect(response.status).toBe(200);
        expect(response.body.map((exercise) => exercise.id)).toEqual(
          expectedIds,
        );
        expect(response.body[0].primaryMuscles).toContain(labels.chest[lang]);
        expect(response.body[0].equipment).toBe(labels.issue66_fixture[lang]);
        expect(commands).toHaveLength(1);
        expect(commands[0]).toMatchObject({
          filter: mongoFilters,
          sort: { _id: 1 },
          skip: page * 2,
          limit: 2,
        });
        expect(transferredDocuments).toBe(expectedIds.length);
      }
    },
  );

  it.each(["en", "pt", "es"])(
    "preserves localized 404 for a page after the last match in %s",
    async (lang) => {
      const response = await request(app).get("/api/exercises").query({
        lang,
        equipment: labels.issue66_fixture[lang],
        force: labels.push[lang],
        primaryMuscles: labels.chest[lang],
        secondaryMuscles: labels.triceps[lang],
        level: labels.expert[lang],
        category: labels.strength[lang],
        page: 3,
        limit: 2,
      });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: errorMessages.noResults[lang] });
      expect(transferredDocuments).toBe(0);
    },
  );

  it("returns 404 for valid filters with no matching document", async () => {
    const response = await request(app)
      .get("/api/exercises")
      .query({ equipment: "test equipment", id: "Does_Not_Exist" });
    expect(response.status).toBe(404);
    expect(transferredDocuments).toBe(0);
  });

  it("preserves direct scalar filters and complete localized response fields", async () => {
    const response = await request(app).get(
      "/api/exercises?id=Issue66_Match_0&mechanic=compound&lang=es",
    );
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: "Issue66_Match_0",
      name: "Ejercicio de integración 0",
      force: "empujar",
      equipment: "equipo de prueba",
      instructions: ["Instrucción de prueba"],
      primaryMuscles: ["hombros", "pecho"],
      secondaryMuscles: ["hombros", "tríceps"],
      images: ["Issue66_Match_0/0.jpg"],
    });
    expect(transferredDocuments).toBe(1);
  });

  it("preserves field selection, header language and explicit language precedence", async () => {
    for (const [params, expectedName] of [
      [{}, "Exercicio de integracao 0"],
      [{ lang: "es" }, "Ejercicio de integración 0"],
    ]) {
      const response = await request(app)
        .get("/api/exercises?id=Issue66_Match_0&fields=images")
        .query(params)
        .set("Accept-Language", "pt-BR");
      expect(response.status).toBe(200);
      expect(response.body[0]).toEqual({
        _id: expect.any(String),
        name: expectedName,
        images: ["Issue66_Match_0/0.jpg"],
      });
      expect(commands.at(-1).projection).toEqual({
        _id: 1,
        id: 1,
        name: 1,
        images: 1,
      });
    }
  });

  it.each(["en", "pt", "es"])(
    "includes all colliding scalar and muscle slugs across pages in %s",
    async (lang) => {
      const filters = await request(app)
        .get("/api/exercises/filters")
        .query({ lang });
      expect(filters.status).toBe(200);
      expect(
        filters.body.equipment.filter(
          (value) => value === collisionLabels[lang],
        ),
      ).toHaveLength(1);
      for (let page = 0; page < 2; page++) {
        const response = await request(app).get("/api/exercises").query({
          lang,
          page,
          limit: 1,
          equipment: collisionLabels[lang],
          primaryMuscles: collisionLabels[lang],
          secondaryMuscles: collisionLabels[lang],
        });
        expect(response.status).toBe(200);
        expect(response.body.map((exercise) => exercise.id)).toEqual([
          `Issue66_Collision_${page}`,
        ]);
        expect(commands.at(-1).filter).toEqual({
          equipment: { $in: collisionSlugs },
          primaryMuscles: { $in: collisionSlugs },
          secondaryMuscles: { $in: collisionSlugs },
        });
      }
    },
  );

  it("keeps consecutive pages ordered and disjoint when a filter index is added", async () => {
    const expectedIds = Array.from(
      { length: 5 },
      (_, index) => `Issue66_Match_${index}`,
    );
    for (const addIndex of [false, true]) {
      if (addIndex)
        await mongoose.connection.db
          .collection("exercises")
          .createIndex({ equipment: 1, level: 1, _id: -1 });
      const actualIds = [];
      for (let page = 0; page < 3; page++) {
        const response = await request(app).get("/api/exercises").query({
          equipment: "test equipment",
          level: "expert",
          force: "push",
          category: "strength",
          primaryMuscles: "chest",
          secondaryMuscles: "triceps",
          page,
          limit: 2,
        });
        expect(response.status).toBe(200);
        actualIds.push(...response.body.map((exercise) => exercise.id));
      }
      expect(actualIds).toEqual(expectedIds);
      expect(new Set(actualIds).size).toBe(expectedIds.length);
    }
  });

  it("bounds the page size and rejects larger requests before querying", async () => {
    const maximum = await request(app).get("/api/exercises?limit=100");
    expect(maximum.status).toBe(200);
    expect(maximum.body).toHaveLength(100);
    expect(transferredDocuments).toBe(100);
    commands = [];
    const excessive = await request(app).get(
      "/api/exercises?limit=101&lang=es",
    );
    expect(excessive.status).toBe(400);
    expect(excessive.body.message).toBe(errorMessages.limitTooLarge.es);
    expect(commands).toHaveLength(0);
  });

  it("fetches only selected data while preserving localization and image recovery", async () => {
    const response = await request(app).get(
      "/api/exercises?id=Issue66_Match_0&fields=force,primaryMuscles,instructions&lang=es",
    );
    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual({
      _id: expect.any(String),
      name: "Ejercicio de integración 0",
      force: "empujar",
      primaryMuscles: ["hombros", "pecho"],
      instructions: ["Instrucción de prueba"],
    });
    expect(commands[0].projection).toEqual({
      _id: 1,
      id: 1,
      name: 1,
      images: 1,
      force: 1,
      primaryMuscles: 1,
      instructions: 1,
    });
  });

  it.each([
    "force=invalid",
    "force=push&force=pull",
    "primaryMuscles=invalid",
    "page=-1",
    "limit=0",
  ])("rejects invalid input before reading exercises: %s", async (params) => {
    const response = await request(app).get(`/api/exercises?${params}`);
    expect(response.status).toBe(400);
    expect(commands).toHaveLength(0);
  });

  it.each([
    "unknown=value",
    "$where=return%20true",
    "name.en=Squat",
    "force[$ne]=push",
  ])(
    "does not forward unsupported query fields to MongoDB: %s",
    async (params) => {
      const response = await request(app).get(`/api/exercises?${params}`);
      expect(response.status).toBe(404);
      expect(commands).toHaveLength(0);
    },
  );

  it("confirms the database execution plan returns only the filtered page", async () => {
    const explanation = await Exercise.find(mongoFilters)
      .sort({ _id: 1 })
      .skip(2)
      .limit(2)
      .explain("executionStats");
    expect(explanation.executionStats.nReturned).toBe(2);
    expect(explanation.executionStats.executionSuccess).toBe(true);
  });
});
