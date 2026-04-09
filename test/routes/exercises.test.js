const express = require("express");
const request = require("supertest");

const fs = require("fs");
const Exercise = require("../../api/Exercise");
const exerciseRoutes = require("../../api/exerciseRoutes");
const { buildExercise } = require("../fixtures/exercises.fixture");

const createFindStub = (exercise) => ({
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  async lean() {
    return [exercise];
  },
});

const createFindOneStub = (exercise) => ({
  async lean() {
    return exercise;
  },
});

describe("exercise routes", () => {
  let app;
  let originalDistinct;
  let originalFind;
  let originalFindOne;
  let originalExistsSync;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/exercises", exerciseRoutes);

    originalDistinct = Exercise.distinct;
    originalFind = Exercise.find;
    originalFindOne = Exercise.findOne;
    originalExistsSync = fs.existsSync;
  });

  afterAll(() => {
    Exercise.distinct = originalDistinct;
    Exercise.find = originalFind;
    Exercise.findOne = originalFindOne;
    fs.existsSync = originalExistsSync;
  });

  const seedStubs = () => {
    const exercise = buildExercise();
    Exercise.distinct = async (field) => {
      switch (field) {
        case "force":
          return [{ en: "push", pt: "empurrar" }];
        case "level":
          return [{ en: "expert", pt: "avancado" }];
        case "category":
          return [{ en: "strength", pt: "forca" }];
        case "equipment":
          return [{ en: "kettlebells", pt: "kettlebells" }];
        case "primaryMuscles.en":
          return ["chest"];
        case "secondaryMuscles.en":
          return ["shoulders", "triceps"];
        case "primaryMuscles.pt":
          return ["peito"];
        case "secondaryMuscles.pt":
          return ["ombros", "triceps"];
        default:
          return [];
      }
    };
    Exercise.findOne = () => createFindOneStub(exercise);
    Exercise.find = () => createFindStub(exercise);
  };

  it("filters by force", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises?force=push");
    expect(response.status).toBe(200);
    expect(response.body[0].force).toBe("push");
  });

  it("filters by level", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises?level=expert");
    expect(response.status).toBe(200);
    expect(response.body[0].level).toBe("expert");
  });

  it("filters by equipment", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises?equipment=kettlebells");
    expect(response.status).toBe(200);
    expect(response.body[0].equipment).toBe("kettlebells");
  });

  it("filters by category", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises?category=strength");
    expect(response.status).toBe(200);
    expect(response.body[0].category).toBe("strength");
  });

  it("filters by primaryMuscles", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises?primaryMuscles=chest");
    expect(response.status).toBe(200);
    expect(response.body[0].primaryMuscles).toEqual(["chest"]);
  });

  it("filters by secondaryMuscles", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises?secondaryMuscles=triceps");
    expect(response.status).toBe(200);
    expect(response.body[0].secondaryMuscles).toEqual(["shoulders", "triceps"]);
  });

  it("returns 400 for invalid primaryMuscles filter", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises?primaryMuscles=invalid");
    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.avaliableOptions)).toBe(true);
    expect(response.body.avaliableOptions).toContain("chest");
  });

  it("searches exercises by query", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises/search?query=Plyo");
    expect(response.status).toBe(200);
    expect(response.body.exercises[0].name).toBe("Plyo Kettlebell Pushups");
  });

  it("returns 400 when search query is missing", async () => {
    seedStubs();
    const response = await request(app).get("/api/exercises/search");
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please provide a search term.");
  });

  it("returns 400 when image is missing", async () => {
    seedStubs();
    fs.existsSync = () => false;
    const response = await request(app).get(
      "/api/exercises/Plyo_Kettlebell_Pushups/0.jpg"
    );
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "image not found in the database, check the name and try again"
    );
  });
});
