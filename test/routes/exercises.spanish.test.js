const express = require("express");
const request = require("supertest");
const Exercise = require("../../api/Exercise");
const { resetCache } = require("../../api/translationCache");
const routes = require("../../api/exerciseRoutes");

const mockDocs = {
  equipment_translations: [
    { key: "barbell", translations: { en: "barbell", pt: "barra", es: "mancuerna" } },
    { key: "dumbbell", translations: { en: "dumbbell", pt: "haltere", es: "mancuerna" } },
  ],
  category_translations: [{ key: "strength", translations: { en: "strength", pt: "força", es: "fortaleza" } }],
  muscle_translations: [
    { key: "abductors", translations: { en: "abductors", pt: "abdutores", es: "secuestradores" } },
    { key: "traps", translations: { en: "traps", pt: "trapézio", es: "trampas" } },
    { key: "calves", translations: { en: "calves", pt: "panturrilhas", es: "Las pantorrillas" } },
    { key: "lats", translations: { en: "lats", pt: "dorsais", es: "Los lats" } },
  ],
};

jest.mock("../../api/Translation", () => collection => ({
  find: () => ({ lean: async () => mockDocs[collection] || [] }),
}));

describe("Spanish exercise vocabulary", () => {
  const app = express();
  app.use("/api/exercises", routes);
  beforeEach(() => {
    resetCache();
    jest.spyOn(Exercise, "find").mockReturnValue({ lean: async () => [
      { id: "Test_Barbell", name: { en: "Squat", es: "Sentadilla con barra" }, equipment: "barbell", category: "strength", primaryMuscles: ["abductors"], secondaryMuscles: ["traps", "calves", "lats"] },
      { id: "Test_Dumbbell", name: { en: "Dumbbell Squat", es: "Sentadilla con mancuerna" }, equipment: "dumbbell", category: "strength", primaryMuscles: [], secondaryMuscles: [] },
    ] });
  });
  afterEach(() => jest.restoreAllMocks());

  it("uses correct Spanish terms in exercise cards and search results", async () => {
    for (const url of ["/api/exercises?lang=es", "/api/exercises/search?lang=es&query=Sentadilla"]) {
      const response = await request(app).get(url);
      expect(response.status).toBe(200);
      const exercises = response.body.exercises || response.body;
      const barbell = exercises.find(exercise => exercise.id === "Test_Barbell");
      expect(barbell).toMatchObject({ equipment: "barra", category: "fuerza", primaryMuscles: ["abductores"], secondaryMuscles: ["trapecios", "pantorrillas", "dorsales"] });
    }
  });

  it("offers separate barbell and dumbbell filters and resolves each to the right slug", async () => {
    const filters = await request(app).get("/api/exercises/filters?lang=es");
    expect(filters.body.equipment).toEqual(["barra", "mancuerna"]);
    expect(filters.body.category).toEqual(["fuerza"]);
    expect(filters.body.primaryMuscles).toEqual(expect.arrayContaining(["abductores", "trapecios"]));
    for (const [value, id] of [["barra", "Test_Barbell"], ["mancuerna", "Test_Dumbbell"]]) {
      const response = await request(app).get(`/api/exercises?lang=es&equipment=${value}`);
      expect(response.status).toBe(200);
      expect(response.body.map(exercise => exercise.id)).toEqual([id]);
    }
  });

  it("preserves English and Portuguese translations", async () => {
    for (const [lang, value] of [["en", "barbell"], ["pt", "barra"]]) {
      const response = await request(app).get(`/api/exercises?lang=${lang}`);
      expect(response.body[0].equipment).toBe(value);
    }
  });
});
