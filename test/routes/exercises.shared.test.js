const {
  buildImagePaths,
  defaultLanguage,
  errorMessages,
  extractValues,
  filterableFields,
  findSlugsByLocalizedValue,
  getErrorLanguage,
  getHeaderLanguage,
  parseFields,
  parseLanguage,
  parseListParameters,
  parsePagination,
  maxLimit,
  serializeExercise,
  supportedLanguages,
  validFields,
  validListParameters,
} = require("../../api/routes/exercises/shared");

const exercise = {
  _id: "exercise-id",
  id: "Bench_Press",
  name: {
    en: "Bench Press",
    pt: "Supino Reto",
    es: "Press de banca",
  },
  force: {
    en: "push",
    pt: "empurrar",
    es: "empujar",
  },
  level: {
    en: "beginner",
    pt: "iniciante",
    es: "principiante",
  },
  mechanic: {
    en: "compound",
    pt: "composto",
    es: "compuesto",
  },
  equipment: {
    en: "barbell",
    pt: "barra",
    es: "barra",
  },
  primaryMuscles: {
    en: ["chest"],
    pt: ["peito"],
    es: ["pecho"],
  },
  secondaryMuscles: {
    en: ["triceps"],
    pt: ["triceps"],
    es: ["tríceps"],
  },
  instructions: {
    en: ["Lie on the bench.", "Press the bar up."],
    pt: ["Deite no banco.", "Empurre a barra."],
    es: ["Acuéstese en el banco.", "Empuje la barra hacia arriba."],
  },
  category: {
    en: "strength",
    pt: "forca",
    es: "fortaleza",
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

    it("negotiates supported regional languages by preference and quality", () => {
      expect(parseLanguage(undefined, "es-ES,es;q=0.9")).toEqual({ lang: "es" });
      expect(parseLanguage(undefined, "fr-FR, PT-br;q=0.8,en;q=0.5")).toEqual({ lang: "pt" });
      expect(parseLanguage(undefined, "pt;q=0.2,es;q=0.9")).toEqual({ lang: "es" });
      expect(parseLanguage(undefined, "es;q=0,pt;q=0.5")).toEqual({ lang: "pt" });
      expect(parseLanguage(undefined, "fr-FR")).toEqual({ lang: "en" });
      expect(parseLanguage("en", "es-ES")).toEqual({ lang: "en" });
    });

    it("uses the accept-language header for invalid language error messages", () => {
      const result = parseLanguage("fr", "pt-BR,pt;q=0.9,en;q=0.8");

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
      expect(getErrorLanguage("fr", "es-ES,es;q=0.9")).toBe("es");
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

    it.each([["name", "images"], { name: "images" }, null])("rejects non-string fields without throwing: %p", (fields) => {
      expect(parseFields(fields, "en").error.status).toBe(400);
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

  describe("list parameter parsing", () => {
    it("accepts control parameters, localized filters including mechanic, and id", () => {
      expect(filterableFields).toEqual([
        "force",
        "level",
        "mechanic",
        "equipment",
        "category",
        "primaryMuscles",
        "secondaryMuscles",
      ]);
      expect(validListParameters).toEqual([
        "lang",
        "page",
        "limit",
        "fields",
        ...filterableFields,
        "id",
      ]);
      expect(
        parseListParameters(
          Object.fromEntries(validListParameters.map((key) => [key, "value"])),
          "en",
        ),
      ).toEqual({});
      expect(parseListParameters({}, "en")).toEqual({});
    });

    it.each(supportedLanguages)(
      "lists invalid parameters and valid parameters in %s",
      (lang) => {
        expect(errorMessages.invalidQueryParameters[lang]).toMatch(/\S/);
        expect(
          parseListParameters(
            { force: "push", unknown: "value", "force[$ne]": "push", $where: "1" },
            lang,
          ),
        ).toEqual({
          error: {
            status: 400,
            body: {
              message: `${errorMessages.invalidQueryParameters[lang]} lang, page, limit, fields, force, level, mechanic, equipment, category, primaryMuscles, secondaryMuscles, id.`,
              invalidParameters: ["unknown", "force[$ne]", "$where"],
            },
          },
        });
      },
    );

    it.each([["first", "second"], { $ne: "first" }])(
      "rejects a direct filter that is not a single string: %p",
      (id) => {
        expect(
          parseListParameters({ id, force: ["push", "pull"] }, "en").error.body
            .invalidParameters,
        ).toEqual(["id"]);
      },
    );
  });

  describe("pagination parsing", () => {
    it("accepts the maximum page size and largest safe offset", () => {
      expect(parsePagination("0", String(maxLimit), "en")).toEqual({ page: 0, limit: maxLimit });
      expect(parsePagination(String(Number.MAX_SAFE_INTEGER), "1", "en")).toEqual({ page: Number.MAX_SAFE_INTEGER, limit: 1 });
      expect(parsePagination("4503599627370495", "2", "en")).toEqual({ page: 4503599627370495, limit: 2 });
    });

    it.each(supportedLanguages)("explains excessive page, limit and offset values in %s", lang => {
      expect(parsePagination("9007199254740992", "2", lang).error.body.message).toBe(errorMessages.pageTooLarge[lang]);
      expect(parsePagination("0", "101", lang).error.body.message).toBe(errorMessages.limitTooLarge[lang]);
      expect(parsePagination("0", "9007199254740992", lang).error.body.message).toBe(errorMessages.limitTooLarge[lang]);
      expect(parsePagination("4503599627370496", "2", lang).error.body.message).toBe(errorMessages.offsetTooLarge[lang].replace("${maxPage}", "4503599627370495"));
    });
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

    it.each([
      [["1", "2"], "10", "invalidPage"],
      [["0", ""], "10", "invalidPage"],
      [{ $gt: "0" }, "10", "invalidPage"],
      ["0", ["5", "10"], "invalidLimit"],
      ["0", ["5", "x"], "invalidLimit"],
      [["1", "2"], ["5", "10"], "invalidPage"],
    ])("rejects repeated or non-string pagination: page %p, limit %p", (page, limit, message) => {
      supportedLanguages.forEach((lang) => {
        expect(parsePagination(page, limit, lang)).toEqual({
          error: {
            status: 400,
            body: { message: errorMessages[message][lang] },
          },
        });
      });
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

  it("resolves every slug sharing a localized label without accepting arrays or operators", () => {
    const translations = { values: { first: { es: "compartido" }, second: { es: "compartido" }, other: { es: "otro" } } };
    expect(findSlugsByLocalizedValue(translations, "values", "compartido", "es")).toEqual(["first", "second"]);
    expect(findSlugsByLocalizedValue(translations, "values", ["compartido"], "es")).toEqual([]);
    expect(findSlugsByLocalizedValue(translations, "values", { $ne: "otro" }, "es")).toEqual([]);
    expect(findSlugsByLocalizedValue(translations, "missing", "compartido", "es")).toEqual([]);
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

    it("localizes exercise responses to Spanish", () => {
      expect(serializeExercise(exercise, "es", null)).toEqual({
        ...exercise,
        name: "Press de banca",
        force: "empujar",
        level: "principiante",
        mechanic: "compuesto",
        equipment: "barra",
        primaryMuscles: ["pecho"],
        secondaryMuscles: ["tríceps"],
        instructions: ["Acuéstese en el banco.", "Empuje la barra hacia arriba."],
        category: "fortaleza",
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
