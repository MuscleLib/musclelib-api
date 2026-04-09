const express = require("express");
const request = require("supertest");

const Exercise = require("../../api/Exercise");
const exerciseRoutes = require("../../api/exerciseRoutes");
const { exercisesFixture } = require("../fixtures/exercises.fixture");

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
      category: "ForÃ§a",
    });
  });

  it("returns a fallback message when translation does not exist", async () => {
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
