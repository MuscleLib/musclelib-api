// Reviewed terminology takes precedence over machine-translated taxonomy labels.
// Keys are the stable slugs stored in exercises, never the translated labels.
const vocabulary = {
  equipment_translations: { barbell: "barra", dumbbell: "mancuerna" },
  category_translations: { strength: "fuerza" },
  muscle_translations: {
    abductors: "abductores",
    traps: "trapecios",
    calves: "pantorrillas",
    lats: "dorsales",
  },
};

const getSpanishTranslation = (collection, key, fallback) =>
  vocabulary[collection]?.[key] || fallback;

const localizeTranslation = (collection, document) => ({
  ...document.translations,
  es: getSpanishTranslation(collection, document.key, document.translations?.es),
});

module.exports = { getSpanishTranslation, localizeTranslation };
