const express = require("express");
const request = require("supertest");
const Exercise = require("../../api/Exercise");
const routes = require("../../api/exerciseRoutes");
const { buildExercise } = require("../fixtures/exercises.fixture");
const {
  errorMessages,
  validListParameters,
} = require("../../api/routes/exercises/shared");

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
    isolation: { en: "isolation", pt: "isolamento", es: "aislamiento" },
  },
  muscle_translations: {
    chest: { en: "chest", pt: "peito", es: "pecho" },
    triceps: { en: "triceps", pt: "triceps", es: "tríceps" },
    shoulders: { en: "shoulders", pt: "ombros", es: "hombros" },
  },
};

const invalidParametersBody = (invalidParameters, lang = "en") => ({
  message: `${errorMessages.invalidQueryParameters[lang]} ${validListParameters.join(", ")}.`,
  invalidParameters,
});

describe("exercise list database filtering and pagination", () => {
  const app = express();
  app.use("/api/exercises", routes);
  let query;

  beforeEach(() => {
    getTranslations.mockClear();
    getTranslations.mockResolvedValue(translations);
    query = {
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
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
    expect(query.sort).toHaveBeenCalledWith({ _id: 1 });
    expect(query.select).not.toHaveBeenCalled();
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
        mechanic: translations.mechanic_translations.compound[lang],
        equipment: translations.equipment_translations.kettlebells[lang],
        category: translations.category_translations.strength[lang],
        primaryMuscles: translations.muscle_translations.chest[lang],
        secondaryMuscles: translations.muscle_translations.triceps[lang],
      });
      expect(response.status).toBe(200);
      expect(Exercise.find).toHaveBeenCalledWith({
        force: { $in: ["push"] },
        level: { $in: ["expert"] },
        mechanic: { $in: ["compound"] },
        equipment: { $in: ["kettlebells"] },
        category: { $in: ["strength"] },
        primaryMuscles: { $in: ["chest"] },
        secondaryMuscles: { $in: ["triceps"] },
      });
      expect(query.skip).toHaveBeenCalledWith(1);
      expect(query.limit).toHaveBeenCalledWith(1);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].primaryMuscles).toEqual([
        translations.muscle_translations.chest[lang],
      ]);
      expect(response.body[0].mechanic).toBe(
        translations.mechanic_translations.compound[lang],
      );
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
        const response = await request(app).get("/api/exercises").query({
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
    expect(query.select).toHaveBeenCalledWith({
      _id: 1,
      id: 1,
      name: 1,
      images: 1,
      equipment: 1,
    });
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

  it("keeps the id filter as literal equality", async () => {
    const response = await request(app).get(
      "/api/exercises?id=Plyo_Kettlebell_Pushups",
    );
    expect(response.status).toBe(200);
    expect(Exercise.find).toHaveBeenCalledWith({
      id: { $eq: "Plyo_Kettlebell_Pushups" },
    });
  });

  it.each([
    ["en", "isolation", "isolation"],
    ["pt", "isolamento", "isolation"],
    ["es", "aislamiento", "isolation"],
    ["pt", "compound", "compound"],
    ["es", "isolation", "isolation"],
  ])(
    "resolves mechanic in %s from %s to its stored slug",
    async (lang, mechanic, slug) => {
      const response = await request(app)
        .get("/api/exercises")
        .query({ lang, mechanic });
      expect(response.status).toBe(200);
      expect(Exercise.find).toHaveBeenCalledWith({ mechanic: { $in: [slug] } });
    },
  );

  it("prefers a mechanic label in the selected language over a matching slug", async () => {
    getTranslations.mockResolvedValue({
      ...translations,
      mechanic_translations: {
        compound: { en: "compound", pt: "isolation" },
        isolation: { en: "isolation", pt: "isolamento" },
      },
    });
    const response = await request(app)
      .get("/api/exercises")
      .query({ lang: "pt", mechanic: "isolation" });
    expect(response.status).toBe(200);
    expect(Exercise.find).toHaveBeenCalledWith({
      mechanic: { $in: ["compound"] },
    });
  });

  it.each(["en", "pt", "es"])(
    "rejects an unknown mechanic with localized options in %s",
    async (lang) => {
      for (const mechanic of ["unknown", "constructor", "__proto__"]) {
        const response = await request(app)
          .get("/api/exercises")
          .query({ lang, mechanic });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          message: errorMessages.invalidValue[lang].replace("${key}", "mechanic"),
          avaliableOptions: Object.values(translations.mechanic_translations)
            .map((labels) => labels[lang])
            .sort((a, b) => a.localeCompare(b)),
        });
      }
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it("accepts stored slugs only for mechanic", async () => {
    const response = await request(app)
      .get("/api/exercises")
      .query({ lang: "pt", force: "push" });
    expect(response.status).toBe(400);
    expect(response.body.avaliableOptions).toEqual(["empurrar"]);
    expect(Exercise.find).not.toHaveBeenCalled();
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
        force: { $in: ["push"] },
        primaryMuscles: { $in: ["chest"] },
        secondaryMuscles: { $in: ["triceps"] },
        id: { $eq: "Plyo_Kettlebell_Pushups" },
        mechanic: { $in: ["compound"] },
      },
      expect.objectContaining({ sort: { _id: 1 }, skip: 6, limit: 2 }),
    );
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Flexoes com Kettlebell");
  });

  it.each([
    "force=invalid",
    "primaryMuscles=invalid",
    "force=push&force=pull",
    "mechanic=compound&mechanic=isolation",
  ])(
    "rejects invalid localized filters before querying: %s",
    async (params) => {
      const response = await request(app).get(`/api/exercises?${params}`);
      expect(response.status).toBe(400);
      expect(response.body.avaliableOptions).toEqual(expect.any(Array));
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["unknown=value", ["unknown"]],
    ["$where=return%20true", ["$where"]],
    ["name.en=Squat", ["name.en"]],
    ["images=example.jpg", ["images"]],
    ["id=first&id=second", ["id"]],
    ["force[$ne]=push", ["force[$ne]"]],
    ["Force=push", ["Force"]],
    ["muscle=chest&force=push&sort=name", ["muscle", "sort"]],
  ])(
    "rejects unsupported parameters before reading translations or exercises: %s",
    async (params, invalidParameters) => {
      const response = await request(app).get(`/api/exercises?${params}`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual(invalidParametersBody(invalidParameters));
      expect(getTranslations).not.toHaveBeenCalled();
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it.each(["pt", "es"])(
    "localizes the unsupported parameter error in %s",
    async (lang) => {
      const response = await request(app)
        .get("/api/exercises?unknown=value")
        .set("Accept-Language", lang);
      expect(response.status).toBe(400);
      expect(response.body).toEqual(invalidParametersBody(["unknown"], lang));
    },
  );

  it.each([
    ["force[$ne]=push", "avaliableOptions"],
    ["mechanic[$ne]=compound", "avaliableOptions"],
    ["id[$ne]=Plyo_Kettlebell_Pushups", "invalidParameters"],
  ])(
    "does not pass nested filter operators to MongoDB with an extended query parser: %s",
    async (params, property) => {
      const extendedApp = express();
      extendedApp.set("query parser", "extended");
      extendedApp.use("/api/exercises", routes);
      const response = await request(extendedApp).get(`/api/exercises?${params}`);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(property);
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["limit=9007199254740992", "limitTooLarge"],
    ["page=9007199254740992", "pageTooLarge"],
    ["limit=101", "limitTooLarge"],
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

  it.each([
    ["page=1&page=2", "invalidPage", "en"],
    ["page=0&page=", "invalidPage", "pt"],
    ["limit=5&limit=10", "invalidLimit", "es"],
    ["limit=5&limit=x", "invalidLimit", "pt"],
    ["page=1&page=2&limit=5&limit=10", "invalidPage", "es"],
  ])(
    "rejects repeated pagination parameters before querying: %s (%s, %s)",
    async (params, message, lang) => {
      const response = await request(app).get(
        `/api/exercises?${params}&lang=${lang}`,
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: errorMessages[message][lang] });
      expect(getTranslations).not.toHaveBeenCalled();
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it("rejects array-shaped pagination with an extended query parser", async () => {
    const extendedApp = express();
    extendedApp.set("query parser", "extended");
    extendedApp.use("/api/exercises", routes);
    for (const [params, message] of [
      ["page[]=1", "invalidPage"],
      ["limit[]=5", "invalidLimit"],
    ]) {
      const response = await request(extendedApp).get(`/api/exercises?${params}`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: errorMessages[message].en });
    }
    expect(Exercise.find).not.toHaveBeenCalled();
  });

  it("explains when the page and limit produce an unsafe offset", async () => {
    const response = await request(app).get(
      "/api/exercises?page=9007199254740991&limit=2&lang=es",
    );
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      errorMessages.offsetTooLarge.es.replace("${maxPage}", "4503599627370495"),
    );
    expect(Exercise.find).not.toHaveBeenCalled();
  });

  it.each([
    ["equipment", "equipment_translations"],
    ["mechanic", "mechanic_translations"],
    ["primaryMuscles", "muscle_translations"],
    ["secondaryMuscles", "muscle_translations"],
  ])(
    "queries all slugs sharing a localized label for %s",
    async (field, collection) => {
      getTranslations.mockResolvedValue({
        ...translations,
        [collection]: {
          first: { en: "shared" },
          second: { en: "shared" },
          other: { en: "other" },
        },
      });
      const response = await request(app)
        .get("/api/exercises")
        .query({ [field]: "shared" });
      expect(response.status).toBe(200);
      expect(Exercise.find).toHaveBeenCalledWith({
        [field]: { $in: ["first", "second"] },
      });
    },
  );

  it("preserves the localized database error response", async () => {
    query.lean.mockRejectedValue(new Error("Database unavailable"));
    const response = await request(app).get("/api/exercises?lang=es");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: errorMessages.fetchError.es,
    });
    expect(response.body).not.toHaveProperty("error");
  });
});
