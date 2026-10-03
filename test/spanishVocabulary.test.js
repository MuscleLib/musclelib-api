const { getSpanishTranslation, localizeTranslation } = require("../api/spanishVocabulary");

describe("reviewed Spanish terminology", () => {
  it("corrects imported labels by slug, preserving distinct equipment", () => {
    expect(getSpanishTranslation("equipment_translations", "barbell", "mancuerna")).toBe("barra");
    expect(getSpanishTranslation("equipment_translations", "dumbbell", "mancuerna")).toBe("mancuerna");
    expect(getSpanishTranslation("muscle_translations", "traps", "trampas")).toBe("trapecios");
  });
  it("preserves unreviewed terms and does not mutate stored translations", () => {
    const document = { key: "custom", translations: { en: "custom", pt: "personalizado", es: "personalizado" } };
    expect(localizeTranslation("equipment_translations", document)).toEqual(document.translations);
    const barbell = { key: "barbell", translations: { en: "barbell", pt: "barra", es: "mancuerna" } };
    expect(localizeTranslation("equipment_translations", barbell).es).toBe("barra");
    expect(barbell.translations.es).toBe("mancuerna");
  });
});
