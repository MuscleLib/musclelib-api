const Exercise = require("../../Exercise");

const {
  errorMessages,
  extractValues,
  normalizeExerciseData,
  parseLanguage,
} = require("./shared");

module.exports = async (req, res) => {
  const parsedLanguage = parseLanguage(req.query.lang, req.headers["accept-language"]);
  if (parsedLanguage.error) {
    return res.status(parsedLanguage.error.status).json(parsedLanguage.error.body);
  }

  const { lang } = parsedLanguage;

  try {
    const exercises = (await Exercise.find({}).lean()).map(normalizeExerciseData);

    const formatOptions = (values) =>
      [...new Set(extractValues(values, lang))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    res.json({
      force: formatOptions(exercises.map((exercise) => exercise.force)),
      level: formatOptions(exercises.map((exercise) => exercise.level)),
      category: formatOptions(exercises.map((exercise) => exercise.category)),
      equipment: formatOptions(exercises.map((exercise) => exercise.equipment)),
      primaryMuscles: formatOptions(exercises.map((exercise) => exercise.primaryMuscles)),
      secondaryMuscles: formatOptions(exercises.map((exercise) => exercise.secondaryMuscles)),
    });
  } catch (err) {
    res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
};
