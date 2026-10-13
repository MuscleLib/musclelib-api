const Exercise = require("../../Exercise");
const { getTranslations } = require("../../translationCache");

const {
  errorMessages,
  filterableFields,
  findSlugByLocalizedValue,
  getLocalizedOptions,
  hydrateExercise,
  parseFields,
  parseLanguage,
  parsePagination,
  serializeExercise,
} = require("./shared");

// Maps each filterable field to its translation collection.
const FILTERABLE_FIELD_TO_COLLECTION = {
  force:           "force_translations",
  level:           "level_translations",
  category:        "category_translations",
  equipment:       "equipment_translations",
  primaryMuscles:  "muscle_translations",
  secondaryMuscles:"muscle_translations",
};

// These stored scalar fields previously supported direct equality filtering.
const DIRECT_FILTER_FIELDS = new Set(["id", "mechanic"]);

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
  const skip = page * limit;

  if (!Number.isSafeInteger(limit)) {
    return res.status(400).json({ message: errorMessages.invalidLimit[lang] });
  }
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
    return res.status(400).json({ message: errorMessages.invalidPage[lang] });
  }

  try {
    const translations = await getTranslations();

    // Only known fields and validated scalar values may enter the MongoDB query.
    const filters = {};
    let hasUnsupportedFilter = false;

    for (const [key, value] of Object.entries(req.query)) {
      if (["lang", "fields", "page", "limit"].includes(key)) continue;

      if (filterableFields.includes(key)) {
        const collection = FILTERABLE_FIELD_TO_COLLECTION[key];
        const slug = findSlugByLocalizedValue(translations, collection, value, lang);
        if (!slug) {
          return res.status(400).json({
            message: errorMessages.invalidValue[lang].replace("${key}", key),
            avaliableOptions: getLocalizedOptions(translations, collection, lang),
          });
        }
        // MongoDB scalar equality also matches an element of a muscle array.
        filters[key] = slug;
      } else if (DIRECT_FILTER_FIELDS.has(key) && typeof value === "string") {
        filters[key] = { $eq: value };
      } else {
        hasUnsupportedFilter = true;
      }
    }

    // Unknown fields did not match the old in-memory equality checks. Preserve
    // that response without allowing arbitrary fields or operators into MongoDB.
    if (hasUnsupportedFilter) {
      return res.status(404).json({ message: errorMessages.noResults[lang] });
    }

    const exercises = await Exercise.find(filters).skip(skip).limit(limit).lean();

    if (exercises.length === 0) {
      return res.status(404).json({ message: errorMessages.noResults[lang] });
    }

    res.json(
      exercises.map((exercise) =>
        serializeExercise(hydrateExercise(exercise, translations), lang, fields),
      ),
    );
  } catch (err) {
    res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
};
