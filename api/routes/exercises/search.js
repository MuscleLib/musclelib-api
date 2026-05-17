const Fuse = require("fuse.js");

const Exercise = require("../../Exercise");
const {
  buildImagePaths,
  errorMessages,
  fuseOptions,
  normalizeExerciseData,
  parseFields,
  parseLanguage,
  serializeExercise,
} = require("./shared");

module.exports = async (req, res) => {
  const parsedLanguage = parseLanguage(req.query.lang, req.headers["accept-language"]);
  if (parsedLanguage.error) {
    return res.status(parsedLanguage.error.status).json(parsedLanguage.error.body);
  }

  const { lang } = parsedLanguage;
  const parsedFields = parseFields(req.query.fields, lang);
  if (parsedFields.error) {
    return res.status(parsedFields.error.status).json(parsedFields.error.body);
  }

  const { fields } = parsedFields;
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ message: errorMessages.missingQuery[lang] });
  }

  try {
    const exercises = (await Exercise.find().lean()).map(normalizeExerciseData);
    const fuse = new Fuse(exercises, fuseOptions);
    const results = fuse.search(query);

    if (results.length === 0) {
      const closestMatch = fuse.search(query, { limit: 1 })[0];
      return res.json({
        message: `${errorMessages.noResults[lang]} ${closestMatch ? closestMatch.item.name[lang] : `${errorMessages.noSugestions[lang]}`}`,
      });
    }

    const filteredResults = results.filter((result) => result.item.name[lang]);

    if (filteredResults.length === 0) {
      return res.json({
        message: `${errorMessages.noTranslation[lang]} ${results[0].item.name.en}`,
      });
    }

    const matchedExercises = filteredResults.map((result) =>
      serializeExercise(result.item, lang, fields, {
        imageFormatter: (exercise) => buildImagePaths(exercise.id),
      })
    );

    res.json({ exercises: matchedExercises });
  } catch (err) {
    console.error(`${errorMessages.searchError[lang]}: ${err.message}`);
    res.status(500).json({
      message: errorMessages.searchError[lang],
      error: err.message,
    });
  }
};
