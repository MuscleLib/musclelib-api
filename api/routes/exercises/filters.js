const translationModel = require("../../Translation");
const { errorMessages, parseLanguage } = require("./shared");

const ForceTranslation = translationModel("force_translations");
const LevelTranslation = translationModel("level_translations");
const CategoryTranslation = translationModel("category_translations");
const EquipmentTranslation = translationModel("equipment_translations");
const MuscleTranslation = translationModel("muscle_translations");

const getTranslations = async (model, lang) => {
  const docs = await model.find({}, { translations: 1, _id: 0 });
  return docs
    .map((doc) => doc.translations?.[lang])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
};

module.exports = async (req, res) => {
  const parsedLanguage = parseLanguage(req.query.lang, req.headers["accept-language"]);
  if (parsedLanguage.error) {
    return res.status(parsedLanguage.error.status).json(parsedLanguage.error.body);
  }

  const { lang } = parsedLanguage;

  try {
    const [force, level, category, equipment, muscles] = await Promise.all([
      getTranslations(ForceTranslation, lang),
      getTranslations(LevelTranslation, lang),
      getTranslations(CategoryTranslation, lang),
      getTranslations(EquipmentTranslation, lang),
      getTranslations(MuscleTranslation, lang),
    ]);

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
