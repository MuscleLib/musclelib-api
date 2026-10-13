const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const exerciseRoutes = require("../../api/exerciseRoutes");

const ensureTranslationModel = (collection) => {
  if (!mongoose.models[collection]) {
    mongoose.models[collection] = {};
  }
  return mongoose.models[collection];
};

describe("GET /api/exercises/filters", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/exercises", exerciseRoutes);
  });

  const seedTranslationStubs = ({
    force = [{ translations: { en: "push", pt: "empurrar" } }],
    level = [{ translations: { en: "beginner", pt: "iniciante" } }],
    mechanic = [
      { key: "isolation", translations: { en: "isolation", pt: "isolamento", es: "aislamiento" } },
      { key: "compound", translations: { en: "compound", pt: "composto", es: "compuesto" } },
    ],
    category = [{ translations: { en: "strength", pt: "forca" } }],
    equipment = [{ translations: { en: "barbell", pt: "barra" } }],
    muscles = [
      { translations: { en: "chest", pt: "peito" } },
      { translations: { en: "triceps", pt: "triceps" } },
    ],
  } = {}) => {
    ensureTranslationModel("force_translations").find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(force),
    }));
    ensureTranslationModel("level_translations").find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(level),
    }));
    ensureTranslationModel("mechanic_translations").find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(mechanic),
    }));
    ensureTranslationModel("category_translations").find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(category),
    }));
    ensureTranslationModel("equipment_translations").find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(equipment),
    }));
    ensureTranslationModel("muscle_translations").find = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(muscles),
    }));
  };

  it("returns 400 for invalid language", async () => {
    const response = await request(app).get("/api/exercises/filters?lang=fr");
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid language. Use 'en', 'pt' or 'es'.");
  });

  it("returns all filter keys in English", async () => {
    seedTranslationStubs();
    const response = await request(app).get("/api/exercises/filters?lang=en");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      force: ["push"],
      level: ["beginner"],
      mechanic: ["compound", "isolation"],
      category: ["strength"],
      equipment: ["barbell"],
      primaryMuscles: expect.any(Array),
      secondaryMuscles: expect.any(Array),
    });
  });

  it("returns translated values in Portuguese", async () => {
    seedTranslationStubs();
    const response = await request(app).get("/api/exercises/filters?lang=pt");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      force: ["empurrar"],
      level: ["iniciante"],
      mechanic: ["composto", "isolamento"],
      category: ["forca"],
      equipment: ["barra"],
      primaryMuscles: ["peito", "triceps"],
      secondaryMuscles: ["peito", "triceps"],
    });
  });

  it("returns the localized mechanic values accepted by the list filter in Spanish", async () => {
    seedTranslationStubs();
    const response = await request(app).get("/api/exercises/filters?lang=es");
    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual([
      "force",
      "level",
      "mechanic",
      "category",
      "equipment",
      "primaryMuscles",
      "secondaryMuscles",
    ]);
    expect(response.body.mechanic).toEqual(["aislamiento", "compuesto"]);
  });

  it("defaults to English when lang is not provided", async () => {
    seedTranslationStubs();
    const response = await request(app).get("/api/exercises/filters");
    expect(response.status).toBe(200);
    expect(response.body.force).toEqual(["push"]);
  });

  it("returns results sorted alphabetically", async () => {
    seedTranslationStubs({
      muscles: [
        { translations: { en: "triceps", pt: "triceps" } },
        { translations: { en: "abs", pt: "abdomen" } },
        { translations: { en: "chest", pt: "peito" } },
      ],
    });
    const response = await request(app).get("/api/exercises/filters?lang=en");
    expect(response.status).toBe(200);
    expect(response.body.primaryMuscles).toEqual(["abs", "chest", "triceps"]);
  });

  it("returns the same list for primaryMuscles and secondaryMuscles", async () => {
    seedTranslationStubs();
    const response = await request(app).get("/api/exercises/filters");
    expect(response.status).toBe(200);
    expect(response.body.primaryMuscles).toEqual(response.body.secondaryMuscles);
  });

  it("returns 500 on database error", async () => {
    ensureTranslationModel("force_translations").find = jest.fn(() => ({
      lean: jest.fn().mockRejectedValue(new Error("DB connection lost")),
    }));
    const response = await request(app).get("/api/exercises/filters");
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Error fetching exercises.");
    expect(response.body).not.toHaveProperty("error");
  });
});
