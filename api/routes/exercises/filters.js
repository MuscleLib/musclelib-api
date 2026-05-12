const Exercise = require("../../Exercise");

const {
  errorMessages,
  extractValues,
  parseLanguage,
} = require("./shared");

module.exports = async (req, res) => {
  const parsedLanguage = parseLanguage(req.query.lang, req.headers["accept-language"]);
  if (parsedLanguage.error) {
    return res.status(parsedLanguage.error.status).json(parsedLanguage.error.body);
  }

  const { lang } = parsedLanguage;

  try {
    const [
      rawForces,
      rawLevels,
      rawCategories,
      rawEquipments,
      rawPrimaryMuscles,
      rawSecondaryMuscles,
    ] = await Promise.all([
      Exercise.distinct("force"),
      Exercise.distinct("level"),
      Exercise.distinct("category"),
      Exercise.distinct("equipment"),
      Exercise.distinct(`primaryMuscles.${lang}`),
      Exercise.distinct(`secondaryMuscles.${lang}`),
    ]);

    const formatOptions = (values) =>
      [...new Set(extractValues(values, lang))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    res.json({
      force: formatOptions(rawForces),
      level: formatOptions(rawLevels),
      category: formatOptions(rawCategories),
      equipment: formatOptions(rawEquipments),
      primaryMuscles: formatOptions(rawPrimaryMuscles),
      secondaryMuscles: formatOptions(rawSecondaryMuscles),
    });
  } catch (err) {
    res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
};
