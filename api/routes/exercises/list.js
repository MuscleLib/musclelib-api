const Exercise = require("../../Exercise");
const { getTranslations } = require("../../translationCache");

const {
  directFilterFields,
  errorMessages,
  filterableFields,
  findSlugsByLocalizedValue,
  getLocalizedOptions,
  hydrateExercise,
  parseFields,
  parseLanguage,
  parseListParameters,
  parsePagination,
  serializeExercise,
} = require("./shared");

// Maps each filterable field to its translation collection.
const FILTERABLE_FIELD_TO_COLLECTION = {
  force:           "force_translations",
  level:           "level_translations",
  mechanic:        "mechanic_translations",
  category:        "category_translations",
  equipment:       "equipment_translations",
  primaryMuscles:  "muscle_translations",
  secondaryMuscles:"muscle_translations",
};

// mechanic only accepted its stored slug (for example, "compound") before it was
// localized. Existing callers may still send that slug with lang=pt or lang=es,
// so it remains a fallback after the labels in the selected language.
const SLUG_FALLBACK_FIELDS = new Set(["mechanic"]);

const findFilterSlugs = (translations, field, value, lang) => {
  const collection = FILTERABLE_FIELD_TO_COLLECTION[field];
  const slugs = findSlugsByLocalizedValue(translations, collection, value, lang);
  if (slugs.length > 0 || !SLUG_FALLBACK_FIELDS.has(field) || typeof value !== "string") {
    return slugs;
  }
  return Object.hasOwn(translations[collection] || {}, value) ? [value] : [];
};

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

  const parsedParameters = parseListParameters(req.query, lang);
  if (parsedParameters.error) {
    return res.status(parsedParameters.error.status).json(parsedParameters.error.body);
  }

  try {
    const translations = await getTranslations();

    // Only known fields and validated scalar values may enter the MongoDB query.
    const filters = {};

    for (const [key, value] of Object.entries(req.query)) {
      if (filterableFields.includes(key)) {
        const collection = FILTERABLE_FIELD_TO_COLLECTION[key];
        const slugs = findFilterSlugs(translations, key, value, lang);
        if (slugs.length === 0) {
          return res.status(400).json({
            message: errorMessages.invalidValue[lang].replace("${key}", key),
            avaliableOptions: getLocalizedOptions(translations, collection, lang),
          });
        }
        // $in supports label collisions for both scalar fields and muscle arrays.
        filters[key] = { $in: slugs };
      } else if (directFilterFields.includes(key)) {
        // parseListParameters only allows a single string for direct filters.
        filters[key] = { $eq: value };
      }
    }

    const query = Exercise.find(filters).sort({ _id: 1 }).skip(skip).limit(limit);
    if (fields) {
      // Keep the fields used by localization and source-data recovery.
      const projection = Object.fromEntries(
        ["_id", "id", "name", "images", ...fields].map((field) => [field, 1]),
      );
      query.select(projection);
    }
    const exercises = await query.lean();

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
