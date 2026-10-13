const express = require("express");
const request = require("supertest");
const Exercise = require("../../api/Exercise");
const { resetCache } = require("../../api/translationCache");
const routes = require("../../api/exerciseRoutes");

jest.mock("../../api/Translation", () => () => ({
  find: () => ({ lean: async () => [] }),
}));

describe("exercise request fields validation", () => {
  const app = express();
  app.use("/api/exercises", routes);
  const exercise = {
    id: "Request_Test",
    name: { en: "Bench Press", pt: "Supino", es: "Press de banca" },
    primaryMuscles: [],
    secondaryMuscles: [],
    images: [],
  };

  beforeEach(() => {
    resetCache();
    jest.spyOn(Exercise, "find").mockReturnValue({
      skip() { return this; },
      limit() { return this; },
      lean: async () => [exercise],
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["/api/exercises?fields=name&fields=images", "/api/exercises/search?query=Bench&fields=name&fields=images"])(
    "returns a localized JSON 400 for repeated fields: %s",
    async (url) => {
      const response = await request(app).get(`${url}&lang=es`);
      expect(response.status).toBe(400);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body.message).toContain("Campo(s) no válido(s)");
      expect(Exercise.find).not.toHaveBeenCalled();
    },
  );

  it("still accepts comma-separated field selection", async () => {
    const response = await request(app).get("/api/exercises?fields=name,images");
    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual({ name: "Bench Press", images: [] });
  });
});
