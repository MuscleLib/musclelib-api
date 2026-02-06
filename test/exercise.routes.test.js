const assert = require("assert/strict");
const { after, before, describe, it } = require("node:test");
const express = require("express");

const fs = require("fs");
const Exercise = require("../api/Exercise");
const exerciseRoutes = require("../api/exerciseRoutes");

const buildExercise = () => ({
  _id: "677471841533c77a3a55b4ff",
  name: { en: "Plyo Kettlebell Pushups", pt: "Flexoes com Kettlebell" },
  force: { en: "push", pt: "empurrar" },
  level: { en: "expert", pt: "avancado" },
  mechanic: { en: "compound", pt: "composto" },
  equipment: { en: "kettlebells", pt: "kettlebells" },
  primaryMuscles: { en: ["chest"], pt: ["peito"] },
  secondaryMuscles: { en: ["shoulders", "triceps"], pt: ["ombros", "triceps"] },
  instructions: {
    en: ["Place a kettlebell on the floor."],
    pt: ["Coloque um kettlebell no chao."],
  },
  category: { en: "strength", pt: "forca" },
  images: ["Plyo_Kettlebell_Pushups/0.jpg", "Plyo_Kettlebell_Pushups/1.jpg"],
  id: "Plyo_Kettlebell_Pushups",
  __v: 0,
});

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
  let server;
  let baseUrl;
  let originalDistinct;
  let originalFind;
  let originalFindOne;
  let originalExistsSync;

  before(() => {
    const app = express();
    app.use(express.json());
    app.use("/api/exercises", exerciseRoutes);
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;

    originalDistinct = Exercise.distinct;
    originalFind = Exercise.find;
    originalFindOne = Exercise.findOne;
    originalExistsSync = fs.existsSync;
  });

  after(() => {
    server.close();
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

  const requestJson = async (path) => {
    const response = await fetch(`${baseUrl}${path}`);
    const json = await response.json();
    return { response, json };
  };

  it("filters by force", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises?force=push");
    assert.equal(response.status, 200);
    assert.equal(json[0].force, "push");
  });

  it("filters by level", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises?level=expert");
    assert.equal(response.status, 200);
    assert.equal(json[0].level, "expert");
  });

  it("filters by equipment", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises?equipment=kettlebells");
    assert.equal(response.status, 200);
    assert.equal(json[0].equipment, "kettlebells");
  });

  it("filters by category", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises?category=strength");
    assert.equal(response.status, 200);
    assert.equal(json[0].category, "strength");
  });

  it("filters by primaryMuscles", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises?primaryMuscles=chest");
    assert.equal(response.status, 200);
    assert.deepEqual(json[0].primaryMuscles, ["chest"]);
  });

  it("filters by secondaryMuscles", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises?secondaryMuscles=triceps");
    assert.equal(response.status, 200);
    assert.deepEqual(json[0].secondaryMuscles, ["shoulders", "triceps"]);
  });

  it("returns 400 for invalid primaryMuscles filter", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises?primaryMuscles=invalid");
    assert.equal(response.status, 400);
    assert.ok(Array.isArray(json.avaliableOptions));
    assert.ok(json.avaliableOptions.includes("chest"));
  });

  it("searches exercises by query", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises/search?query=Plyo");
    assert.equal(response.status, 200);
    assert.equal(json.exercises[0].name, "Plyo Kettlebell Pushups");
  });

  it("returns 400 when search query is missing", async () => {
    seedStubs();
    const { response, json } = await requestJson("/api/exercises/search");
    assert.equal(response.status, 400);
    assert.equal(json.message, "Please provide a search term.");
  });

  it("returns 400 when image is missing", async () => {
    seedStubs();
    fs.existsSync = () => false;
    const { response, json } = await requestJson(
      "/api/exercises/Plyo_Kettlebell_Pushups/0.jpg"
    );
    assert.equal(response.status, 400);
    assert.equal(json.message, "image not found in the database, check the name and try again");
  });
});
