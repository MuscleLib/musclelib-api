const express = require("express");
const request = require("supertest");

const Exercise = require("../../api/Exercise");
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
    const response = await request(app).get("/api/exercises/search?query=Bench&lang=es");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid language. Use 'en' or 'pt'.");
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
});
