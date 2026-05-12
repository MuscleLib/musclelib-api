const {
  buildImagePaths,
  defaultLanguage,
  errorMessages,
  extractValues,
  getErrorLanguage,
  getHeaderLanguage,
  parseFields,
  parseLanguage,
  parsePagination,
  serializeExercise,
  supportedLanguages,
  validFields,
} = require("../../api/routes/exercises/shared");

const exercise = {
  _id: "exercise-id",
  id: "Bench_Press",
  name: {
    en: "Bench Press",
    pt: "Supino Reto",
  },
  force: {
    en: "push",
    pt: "empurrar",
  },
  level: {
    en: "beginner",
    pt: "iniciante",
  },
  mechanic: {
    en: "compound",
    pt: "composto",
  },
  equipment: {
    en: "barbell",
    pt: "barra",
  },
  primaryMuscles: {
    en: ["chest"],
    pt: ["peito"],
  },
  secondaryMuscles: {
    en: ["triceps"],
    pt: ["triceps"],
  },
  instructions: {
    en: ["Lie on the bench.", "Press the bar up."],
    pt: ["Deite no banco.", "Empurre a barra."],
  },
  category: {
    en: "strength",
    pt: "forca",
  },
  images: ["Bench_Press/0.jpg", "Bench_Press/1.jpg"],
};

describe("exercise shared helpers", () => {
  describe("language parsing", () => {
    it("uses the default language when no language is requested", () => {
      expect(parseLanguage(undefined)).toEqual({ lang: defaultLanguage });
    });

    it("accepts supported requested languages", () => {
      supportedLanguages.forEach((language) => {
        expect(parseLanguage(language)).toEqual({ lang: language });
      });
    });

    it("uses the accept-language header for invalid language error messages", () => {
      const result = parseLanguage("es", "pt-BR,pt;q=0.9,en;q=0.8");

      expect(result).toEqual({
        error: {
          status: 400,
          body: {
            message: errorMessages.invalidLang.pt,
          },
        },
      });
    });

    it("falls back to the default language for unsupported accept-language headers", () => {
      expect(getHeaderLanguage("es-ES,es;q=0.9")).toBe("es");
      expect(getErrorLanguage("es", "es-ES,es;q=0.9")).toBe(defaultLanguage);
    });
  });

  describe("field parsing", () => {
    it("returns null fields when fields are not requested", () => {
      expect(parseFields(undefined, "en")).toEqual({ fields: null });
    });

    it("trims requested fields", () => {
      expect(parseFields(" name, equipment ,category ", "en")).toEqual({
        fields: ["name", "equipment", "category"],
      });
    });

    it("returns valid fields in the empty fields error", () => {
      const result = parseFields("", "en");

      expect(result.error.status).toBe(400);
      expect(result.error.body.message).toBe(
        `${errorMessages.invalideParametters.en} ${validFields.join(", ")}.`,
      );
    });

    it("returns the invalid field names", () => {
      const result = parseFields("name,unknown,badField", "en");

      expect(result).toEqual({
        error: {
          status: 400,
          body: {
            message: `${errorMessages.invalidFields.en} ${validFields.join(", ")}.`,
            invalidFields: ["unknown", "badField"],
          },
        },
      });
    });
  });

  describe("pagination parsing", () => {
    it("uses default pagination values", () => {
      expect(parsePagination(undefined, undefined, "en")).toEqual({
        page: 0,
        limit: 50,
      });
    });

    it("parses valid pagination params", () => {
      expect(parsePagination("2", "25", "en")).toEqual({
        page: 2,
        limit: 25,
      });
    });

    it("rejects empty page or limit params", () => {
      expect(parsePagination("", "10", "en").error.body.message).toBe(
        errorMessages.invalideParamettersPageLimit.en,
      );
      expect(parsePagination("0", "", "pt").error.body.message).toBe(
        errorMessages.invalideParamettersPageLimit.pt,
      );
    });

    it("rejects negative page and zero limit values", () => {
      expect(parsePagination("-1", "10", "en").error.body.message).toBe(
        errorMessages.invalidPage.en,
      );
      expect(parsePagination("0", "0", "pt").error.body.message).toBe(
        errorMessages.invalidLimit.pt,
      );
    });
  });

  describe("value extraction and images", () => {
    it("extracts strings and localized object values from mixed data", () => {
      const values = extractValues(
        [["chest", "triceps"], { en: "push", pt: "empurrar" }, "en", "strength"],
        "en",
      );

      expect(values).toEqual(["chest", "triceps", "push", "strength"]);
    });

    it("builds standard image paths", () => {
      expect(buildImagePaths("Bench_Press")).toEqual([
        "Bench_Press/0.jpg",
        "Bench_Press/1.jpg",
      ]);
    });
  });

  describe("exercise serialization", () => {
    it("localizes every translated field for full exercise responses", () => {
      expect(serializeExercise(exercise, "pt", null)).toEqual({
        ...exercise,
        name: "Supino Reto",
        force: "empurrar",
        level: "iniciante",
        mechanic: "composto",
        equipment: "barra",
        primaryMuscles: ["peito"],
        secondaryMuscles: ["triceps"],
        instructions: ["Deite no banco.", "Empurre a barra."],
        category: "forca",
        images: exercise.images,
      });
    });

    it("returns _id and name with only requested fields", () => {
      expect(serializeExercise(exercise, "en", ["equipment", "category"])).toEqual({
        _id: "exercise-id",
        name: "Bench Press",
        equipment: "barbell",
        category: "strength",
      });
    });

    it("ignores repeated name requests because name is always included", () => {
      expect(serializeExercise(exercise, "en", ["name"])).toEqual({
        _id: "exercise-id",
        name: "Bench Press",
      });
    });

    it("uses a custom image formatter when serializing images", () => {
      const result = serializeExercise(exercise, "en", ["images"], {
        imageFormatter: (currentExercise) => buildImagePaths(currentExercise.id),
      });

      expect(result).toEqual({
        _id: "exercise-id",
        name: "Bench Press",
        images: ["Bench_Press/0.jpg", "Bench_Press/1.jpg"],
      });
    });
  });
});
