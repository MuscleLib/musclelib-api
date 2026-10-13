const express = require("express");
const request = require("supertest");
const Exercise = require("../../api/Exercise");
const routes = require("../../api/exerciseRoutes");
const { buildExercise } = require("../fixtures/exercises.fixture");
const { errorMessages } = require("../../api/routes/exercises/shared");

jest.mock("../../api/translationCache");
const { getTranslations } = require("../../api/translationCache");

const translations = {
  force_translations: { push: { en: "push", pt: "empurrar", es: "empujar" } },
  level_translations: {
    expert: { en: "expert", pt: "avancado", es: "experto" },
  },
  equipment_translations: {
    kettlebells: { en: "kettlebells", pt: "kettlebells", es: "pesas rusas" },
  },
  category_translations: {
    strength: { en: "strength", pt: "forca", es: "fuerza" },
  },
  mechanic_translations: {
    compound: { en: "compound", pt: "composto", es: "compuesto" },
  },
  muscle_translations: {
    chest: { en: "chest", pt: "peito", es: "pecho" },
    triceps: { en: "triceps", pt: "triceps", es: "tríceps" },
    shoulders: { en: "shoulders", pt: "ombros", es: "hombros" },
  },
};

describe("exercise list database filtering and pagination", () => {
  const app = express();
  app.use("/api/exercises", routes);
  let query;

  beforeEach(() => {
    getTranslations.mockResolvedValue(translations);
    query = {
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([buildExercise()]),
    };
    jest.spyOn(Exercise, "find").mockReturnValue(query);
  });
  afterEach(() => jest.restoreAllMocks());

  it("applies the default page limit in MongoDB", async () => {
    const response = await request(app).get("/api/exercises");
    expect(response.status).toBe(200);
    expect(Exercise.find).toHaveBeenCalledTimes(1);
    expect(Exercise.find).toHaveBeenCalledWith({});
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(50);
    expect(query.lean).toHaveBeenCalledTimes(1);
    expect(response.body[0]).toMatchObject({
      name: "Plyo Kettlebell Pushups",
      force: "push",
    });
  });

  it.each(["en", "pt", "es"])(
    "combines all localized filters before paginating (%s)",
    async (lang) => {
      const response = await request(app).get("/api/exercises").query({
        lang,
        page: 1,
        limit: 1,
        force: translations.force_translations.push[lang],
        level: translations.level_translations.expert[lang],
        equipment: translations.equipment_translations.kettlebells[lang],
        category: translations.category_translations.strength[lang],
        primaryMuscles: translations.muscle_translations.chest[lang],
        secondaryMuscles: translations.muscle_translations.triceps[lang],
      });
      expect(response.status).toBe(200);
      expect(Exercise.find).toHaveBeenCalledWith({
        force: "push",
        level: "expert",
        equipment: "kettlebells",
        category: "strength",
        primaryMuscles: "chest",
        secondaryMuscles: "triceps",
      });
      expect(query.skip).toHaveBeenCalledWith(1);
      expect(query.limit).toHaveBeenCalledWith(1);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].primaryMuscles).toEqual([
        translations.muscle_translations.chest[lang],
      ]);
    },
  );

  it.each([
    [0, 2],
    [1, 2],
    [2, 1],
  ])(
    "returns the database page unchanged at boundary %i",
    async (page, count) => {
      const docs = Array.from({ length: count }, (_, index) =>
        buildExercise({ id: `Page_${page}_${index}` }),
      );
      query.lean.mockResolvedValue(docs);
      const response = await request(app)
        .get("/api/exercises")
        .query({ page, limit: 2 });
      expect(response.status).toBe(200);
      expect(query.skip).toHaveBeenCalledWith(page * 2);
      expect(query.limit).toHaveBeenCalledWith(2);
      expect(response.body.map((exercise) => exercise.id)).toEqual(
        docs.map((exercise) => exercise.id),
      );
    },
  );

  it.each(["en", "pt", "es"])(
    "preserves the localized 404 for empty or exhausted pages (%s)",
    async (lang) => {
      query.lean.mockResolvedValue([]);
      for (const page of [0, 3]) {
        const response = await request(app)
          .get("/api/exercises")
          .query({
            lang,
            page,
            limit: 2,
            force: translations.force_translations.push[lang],
          });
        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          message: errorMessages.noResults[lang],
        });
      }
    },
  );

  it("preserves field selection and header language on a paginated result", async () => {
    const response = await request(app)
      .get("/api/exercises?page=1&limit=1&fields=equipment,images")
      .set("Accept-Language", "pt-BR");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        _id: "677471841533c77a3a55b4ff",
        name: "Flexoes com Kettlebell",
        equipment: "kettlebells",
        images: [
          "Plyo_Kettlebell_Pushups/0.jpg",
          "Plyo_Kettlebell_Pushups/1.jpg",
        ],
      },
    ]);
  });

  it("keeps direct id and mechanic filters as literal equality", async () => {
    const response = await request(app).get(
      "/api/exercises?id=Plyo_Kettlebell_Pushups&mechanic=compound",
    );
    expect(response.status).toBe(200);
    expect(Exercise.find).toHaveBeenCalledWith({
      id: { $eq: "Plyo_Kettlebell_Pushups" },
      mechanic: { $eq: "compound" },
    });
  });

  it("passes the filters and pagination through real Mongoose to the database driver", async () => {
    Exercise.find.mockRestore();
    const collectionFind = jest
      .spyOn(Exercise.collection, "find")
      .mockResolvedValue({ toArray: async () => [buildExercise()] });
    const response = await request(app).get("/api/exercises").query({
      lang: "pt",
      force: "empurrar",
      primaryMuscles: "peito",
      secondaryMuscles: "triceps",
      id: "Plyo_Kettlebell_Pushups",
      mechanic: "compound",
      page: 3,
      limit: 2,
    });
    expect(response.status).toBe(200);
    expect(collectionFind).toHaveBeenCalledTimes(1);
    expect(collectionFind).toHaveBeenCalledWith(
      {
        force: "push",
        primaryMuscles: "chest",
        secondaryMuscles: "triceps",
        id: { $eq: "Plyo_Kettlebell_Pushups" },
        mechanic: { $eq: "compound" },
      },
      expect.objectContaining({ skip: 6, limit: 2 }),
    );
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Flexoes com Kettlebell");
  });

  it.each(["force=invalid", "primaryMuscles=invalid", "force=push&force=pull"])(
    "rejects invalid localized filters before querying: %s",
    async (params) => {
      const response = await request(app).get(`/api/exercises?${params}`);
      expect(response.status).toBe(400);
      expect(response.body.avaliableOptions).toEqual(expect.any(Array));
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it.each([
    "unknown=value",
    "$where=return%20true",
    "name.en=Squat",
    "images=example.jpg",
    "id=first&id=second",
    "force[$ne]=push",
  ])(
    "preserves no results for unsupported filters without forwarding them: %s",
    async (params) => {
      const response = await request(app).get(`/api/exercises?${params}`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: errorMessages.noResults.en });
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it("does not pass nested filter operators to MongoDB with an extended query parser", async () => {
    const extendedApp = express();
    extendedApp.set("query parser", "extended");
    extendedApp.use("/api/exercises", routes);
    const response = await request(extendedApp).get(
      "/api/exercises?force[$ne]=push",
    );
    expect(response.status).toBe(400);
    expect(Exercise.find).not.toHaveBeenCalled();
  });

  it.each([
    ["limit=9007199254740992", "invalidLimit"],
    ["page=9007199254740992", "invalidPage"],
    ["page=9007199254740991&limit=2", "invalidPage"],
    ["page=-1", "invalidPage"],
    ["limit=0", "invalidLimit"],
  ])(
    "rejects invalid or unsafe pagination before querying: %s",
    async (params, message) => {
      const response = await request(app).get(`/api/exercises?${params}`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: errorMessages[message].en });
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it("preserves the localized database error response", async () => {
    query.lean.mockRejectedValue(new Error("Database unavailable"));
    const response = await request(app).get("/api/exercises?lang=es");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: errorMessages.fetchError.es,
      error: "Database unavailable",
    });
  });
});
