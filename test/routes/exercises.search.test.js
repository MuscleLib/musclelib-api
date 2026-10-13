const express = require("express");
const request = require("supertest");
const { performance } = require("node:perf_hooks");

const Exercise = require("../../api/Exercise");
const { resetSearchIndex, SEARCH_INDEX_TTL_MS } = require("../../api/searchIndexCache");
const exerciseRoutes = require("../../api/exerciseRoutes");
const { exercisesFixture } = require("../fixtures/exercises.fixture");

jest.mock("../../api/translationCache");
const { getTranslations } = require("../../api/translationCache");

// Translations match the original capitalization from the seed data.
const buildTranslations = () => ({
  force_translations:     { push: { en: "Push", pt: "Empurrar" } },
  level_translations:     { intermediate: { en: "Intermediate", pt: "Intermediário" }, beginner: { en: "Beginner", pt: "Iniciante" } },
  mechanic_translations:  { compound: { en: "Compound", pt: "Composto" } },
  equipment_translations: { barbell: { en: "Barbell", pt: "Barra" } },
  category_translations:  { strength: { en: "Strength", pt: "Força" } },
  muscle_translations:    {
    chest:   { en: "Chest",   pt: "Peito"   },
    triceps: { en: "Triceps", pt: "Tríceps" },
    legs:    { en: "Legs",    pt: "Pernas"  },
    glutes:  { en: "Glutes",  pt: "Glúteos" },
  },
});

describe("exercise search route", () => {
  let app;
  let originalFind;

  beforeEach(() => {
    resetSearchIndex();
    jest.clearAllMocks();
  });

  afterEach(() => jest.restoreAllMocks());

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/exercises", exerciseRoutes);
    originalFind = Exercise.find;
  });

  afterAll(() => {
    Exercise.find = originalFind;
  });

  it("returns only requested fields in portuguese", async () => {
    getTranslations.mockResolvedValue(buildTranslations());
    Exercise.find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(exercisesFixture),
    }));

    const response = await request(app).get(
      "/api/exercises/search?query=Bench&lang=pt&fields=equipment,category"
    );

    expect(response.status).toBe(200);
    expect(response.body.exercises).toHaveLength(1);
    expect(response.body.exercises[0]).toEqual({
      _id: "1",
      name: "Supino Reto",
      equipment: "Barra",
      category: "Força",
    });
  });

  it("returns 400 for an invalid language", async () => {
    const response = await request(app).get("/api/exercises/search?query=Bench&lang=fr");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid language. Use 'en', 'pt' or 'es'.");
  });

  it("returns 400 for invalid fields", async () => {
    const response = await request(app).get(
      "/api/exercises/search?query=Bench&fields=equipment,unknown"
    );

    expect(response.status).toBe(400);
    expect(response.body.invalidFields).toEqual(["unknown"]);
  });

  it("returns generated image urls when images are requested", async () => {
    getTranslations.mockResolvedValue(buildTranslations());
    Exercise.find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(exercisesFixture),
    }));

    const response = await request(app).get(
      "/api/exercises/search?query=Bench&fields=images"
    );

    expect(response.status).toBe(200);
    expect(response.body.exercises[0]).toEqual({
      _id: "1",
      name: "Bench Press",
      images: ["Bench_Press/0.jpg", "Bench_Press/1.jpg"],
    });
  });

  it("returns a fallback message when translation does not exist", async () => {
    getTranslations.mockResolvedValue(buildTranslations());
    Exercise.find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(exercisesFixture),
    }));

    const response = await request(app).get(
      "/api/exercises/search?query=Squat&lang=pt"
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "Exercício não disponível no idioma selecionado. Tente: Squat"
    );
  });

  it("shares an index across search terms, languages and field selections", async () => {
    getTranslations.mockResolvedValue(buildTranslations());
    Exercise.find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([{
        ...exercisesFixture[0],
        name: { en: "Bench Press", pt: "Supino Reto", es: "Press de banca" },
      }]),
    }));

    const english = await request(app).get("/api/exercises/search?query=Bench&fields=images");
    const portuguese = await request(app).get("/api/exercises/search?query=Supino&lang=pt&fields=equipment");
    const spanish = await request(app)
      .get("/api/exercises/search?query=banca&fields=name")
      .set("Accept-Language", "es-ES");
    const englishAgain = await request(app).get("/api/exercises/search?query=Bench&fields=images");

    expect(english.body.exercises[0]).toEqual({
      _id: "1", name: "Bench Press", images: ["Bench_Press/0.jpg", "Bench_Press/1.jpg"],
    });
    expect(portuguese.body.exercises[0]).toEqual({
      _id: "1", name: "Supino Reto", equipment: "Barra",
    });
    expect(spanish.body.exercises[0]).toEqual({ _id: "1", name: "Press de banca" });
    expect(englishAgain.body).toEqual(english.body);
    expect(Exercise.find).toHaveBeenCalledTimes(1);
    expect(getTranslations).toHaveBeenCalledTimes(1);
  });

  it("preserves localized no-results messages while caching an empty catalog", async () => {
    getTranslations.mockResolvedValue(buildTranslations());
    Exercise.find = jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) }));

    for (const [lang, message] of [
      ["en", "No exercises found. No suggestions available."],
      ["pt", "Nenhum exercício encontrado. Nenhuma sugestão disponível."],
      ["es", "No se encontraron ejercicios. No hay sugerencias disponibles."],
    ]) {
      const response = await request(app).get(`/api/exercises/search?query=Bench&lang=${lang}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message });
    }
    expect(Exercise.find).toHaveBeenCalledTimes(1);
  });

  it("returns the existing no-results response for an unmatched query on a warm index", async () => {
    getTranslations.mockResolvedValue(buildTranslations());
    Exercise.find = jest.fn(() => ({ lean: jest.fn().mockResolvedValue(exercisesFixture) }));
    await request(app).get("/api/exercises/search?query=Bench");
    const response = await request(app).get("/api/exercises/search?query=zzzzzzzz&lang=es");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "No se encontraron ejercicios. No hay sugerencias disponibles." });
    expect(Exercise.find).toHaveBeenCalledTimes(1);
  });

  it("returns the localized 500 on refresh failure and retries the next request", async () => {
    const clock = jest.spyOn(performance, "now").mockReturnValue(1000);
    jest.spyOn(console, "error").mockImplementation(() => {});
    getTranslations.mockResolvedValue(buildTranslations());
    const lean = jest.fn().mockResolvedValue(exercisesFixture);
    Exercise.find = jest.fn(() => ({ lean }));
    await request(app).get("/api/exercises/search?query=Bench");

    clock.mockReturnValue(1000 + SEARCH_INDEX_TTL_MS);
    lean.mockRejectedValueOnce(new Error("Database unavailable"));
    const failed = await request(app).get("/api/exercises/search?query=Bench&lang=es");
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      message: "Error al buscar ejercicios.",
    });
    expect(JSON.stringify(failed.body)).not.toContain("Database unavailable");
    const recovered = await request(app).get("/api/exercises/search?query=Bench");
    expect(recovered.status).toBe(200);
    expect(recovered.body.exercises[0].name).toBe("Bench Press");
    expect(Exercise.find).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid requests before loading the index", async () => {
    Exercise.find = jest.fn();
    for (const query of ["", "?query=Bench&lang=fr", "?query=Bench&fields=unknown", "?query=Bench&fields=name&fields=images"]) {
      expect((await request(app).get(`/api/exercises/search${query}`)).status).toBe(400);
    }
    expect(Exercise.find).not.toHaveBeenCalled();
    expect(getTranslations).not.toHaveBeenCalled();
  });
});
