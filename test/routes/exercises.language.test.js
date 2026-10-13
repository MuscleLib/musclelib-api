const express = require("express");
const request = require("supertest");
const Exercise = require("../../api/Exercise");
const { resetCache } = require("../../api/translationCache");
const { resetSearchIndex } = require("../../api/searchIndexCache");
const routes = require("../../api/exerciseRoutes");

jest.mock("../../api/Translation", () => collection => ({
  find: () => ({ lean: async () => collection === "force_translations"
    ? [{ translations: { en: "push", pt: "empurrar", es: "empujar" } }] : [] }),
}));

describe("exercise request language negotiation", () => {
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
    resetSearchIndex();
    jest.spyOn(Exercise, "find").mockReturnValue({ lean: async () => [exercise] });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["/api/exercises", "/api/exercises/search?query=Bench"])(
    "uses the header language in %s, with an explicit query taking priority",
    async (url) => {
      const response = await request(app).get(url).set("Accept-Language", "es-ES,es;q=0.9");
      expect(response.status).toBe(200);
      expect((response.body.exercises || response.body)[0].name).toBe("Press de banca");

      const explicit = await request(app)
        .get(`${url}${url.includes("?") ? "&" : "?"}lang=pt`)
        .set("Accept-Language", "es-ES");
      expect(explicit.status).toBe(200);
      expect((explicit.body.exercises || explicit.body)[0].name).toBe("Supino");
    },
  );

  it("uses the header language for filter options", async () => {
    const response = await request(app).get("/api/exercises/filters").set("Accept-Language", "es-ES");
    expect(response.status).toBe(200);
    expect(response.body.force).toEqual(["empujar"]);
  });

  it("localizes filter validation errors using the header", async () => {
    const response = await request(app)
      .get("/api/exercises/filters?lang=fr")
      .set("Accept-Language", "fr-FR, ES-es;q=0.9, en;q=0.5");
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Idioma no válido. Use 'en', 'pt' o 'es'.");
  });

});
