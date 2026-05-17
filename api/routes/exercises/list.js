const Exercise = require("../../Exercise");

const {
  errorMessages,
  extractValues,
  filterableFields,
  normalizeExerciseData,
  parseFields,
  parseLanguage,
  parsePagination,
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
  const parsedPagination = parsePagination(req.query.page, req.query.limit, lang);
  if (parsedPagination.error) {
    return res.status(parsedPagination.error.status).json(parsedPagination.error.body);
  }

  const { page, limit } = parsedPagination;
  const query = {};

  try {
    const allExercises = (await Exercise.find({}).lean()).map(normalizeExerciseData);
    const valuesForField = (field) =>
      allExercises.flatMap((exercise) => extractValues([exercise[field]], lang));

    const filters = {
      force: valuesForField("force"),
      level: valuesForField("level"),
      category: valuesForField("category"),
      equipment: valuesForField("equipment"),
      primaryMuscles: valuesForField("primaryMuscles"),
      secondaryMuscles: valuesForField("secondaryMuscles"),
    };

    for (const [key, value] of Object.entries(req.query)) {
      if (["lang", "fields", "page", "limit"].includes(key)) {
        continue;
      }

      if (filterableFields.includes(key)) {
        if (!filters[key].includes(value)) {
          return res.status(400).json({
            message: errorMessages.invalidValue[lang].replace("${key}", key),
            avaliableOptions: filters[key],
          });
        }

        query[key] = value;
        continue;
      }

      query[key] = value;
    }

    const matchesValue = (rawValue, filterValue) =>
      extractValues([rawValue], lang).some(
        (value) => value.toLowerCase() === filterValue.toLowerCase(),
      );

    const exercises = allExercises
      .filter((exercise) =>
        Object.entries(query).every(([key, value]) => {
          if (filterableFields.includes(key)) {
            return matchesValue(exercise[key], value);
          }

          return exercise[key] === value;
        }),
      )
      .slice(page * limit, page * limit + limit);

    if (exercises.length === 0) {
      return res.status(404).json({
        message: errorMessages.noResults[lang],
      });
    }

    res.json(exercises.map((exercise) => serializeExercise(exercise, lang, fields)));
  } catch (err) {
    res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
};
