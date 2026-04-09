const Exercise = require("../../Exercise");

const {
  errorMessages,
  extractValues,
  filterableFields,
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
    const rawForces = await Exercise.distinct("force");
    const rawLevels = await Exercise.distinct("level");
    const rawCategories = await Exercise.distinct("category");
    const rawEquipments = await Exercise.distinct("equipment");
    const rawPrimaryMuscles = await Exercise.distinct(`primaryMuscles.${lang}`);
    const rawSecondaryMuscles = await Exercise.distinct(`secondaryMuscles.${lang}`);

    const filters = {
      force: extractValues(rawForces, lang),
      level: extractValues(rawLevels, lang),
      category: extractValues(rawCategories, lang),
      equipment: extractValues(rawEquipments, lang),
      primaryMuscles: extractValues(rawPrimaryMuscles, lang),
      secondaryMuscles: extractValues(rawSecondaryMuscles, lang),
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

        query[`${key}.${lang}`] = new RegExp(`^${value}`, "i");
        continue;
      }

      query[key] = value;
    }

    const exercises = await Exercise.find(query)
      .skip(page * limit)
      .limit(limit)
      .lean();

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
