const Translation = require("../../Translation");
const { localizeTranslation } = require("../../spanishVocabulary");

const { errorMessages, parseLanguage } = require("./shared");

const formatTranslations = (translations, lang, collection) =>
  [...new Set(translations.map((translation) => localizeTranslation(collection, translation)[lang]).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );

const getTranslationValues = async (collection, lang) => {
  const model = Translation(collection);
  const translations = await model.find().lean();
  return formatTranslations(translations, lang, collection);
};

module.exports = async (req, res) => {
  const parsedLanguage = parseLanguage(req.query.lang, req.headers["accept-language"]);
  if (parsedLanguage.error) {
    return res.status(parsedLanguage.error.status).json(parsedLanguage.error.body);
  }

  const { lang } = parsedLanguage;

  try {
    const force = await getTranslationValues("force_translations", lang);
    const level = await getTranslationValues("level_translations", lang);
    const category = await getTranslationValues("category_translations", lang);
    const equipment = await getTranslationValues("equipment_translations", lang);
    const muscles = await getTranslationValues("muscle_translations", lang);

    res.json({
      force,
      level,
      category,
      equipment,
      primaryMuscles: muscles,
      secondaryMuscles: muscles,
    });
  } catch (err) {
    res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
};
