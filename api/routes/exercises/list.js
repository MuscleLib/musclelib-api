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

  try {
    const translations = await getTranslations();

    // Resolve each filterable query param to its English slug.
    // Non-filterable params are kept as direct equality filters.
    const slugFilters = {};
    const directFilters = {};

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
        slugFilters[key] = slug;
      } else {
        directFilters[key] = value;
      }
    }

    const allExercises = await Exercise.find({}).lean();

    const filtered = allExercises
      .filter((exercise) => {
        const slugMatch = Object.entries(slugFilters).every(([key, slug]) => {
          if (key === "primaryMuscles" || key === "secondaryMuscles") {
            return (exercise[key] || []).includes(slug);
          }
          return exercise[key] === slug;
        });
        const directMatch = Object.entries(directFilters).every(
          ([key, value]) => exercise[key] === value,
        );
        return slugMatch && directMatch;
      })
      .slice(page * limit, page * limit + limit);

    if (filtered.length === 0) {
      return res.status(404).json({ message: errorMessages.noResults[lang] });
    }

    res.json(
      filtered.map((exercise) =>
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
