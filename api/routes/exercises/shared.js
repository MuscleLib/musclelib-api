const errorMessages = {
  invalidLang: {
    en: "Invalid language. Use 'en' or 'pt'.",
    pt: "Idioma inválido. Use 'en' ou 'pt'.",
  },
  invalideParametters: {
    en: "The field(s) parameter(s) cannot be empty. Valid fields are:",
    pt: "O(s) parâmetro(s) de campo(s) não pode(m) estar vazio(s). Campos válidos são:",
  },
  invalidFields: {
    en: "Invalid field(s). Valid fields are:",
    pt: "Campo(s) inválido(s). Campos válidos são:",
  },
  missingQuery: {
    en: "Please provide a search term.",
    pt: "Por favor, insira um termo de pesquisa.",
  },
  invalideParamettersPageLimit: {
    en: "The 'page' and 'limit' parameters cannot be empty.",
    pt: "Os parâmetros 'page' e 'limit' não podem estar vazios.",
  },
  invalidPage: {
    en: "parameter 'page' is invalid. use a value greater than or equal to 0.",
    pt: "Parâmetro 'page' inválido. use um valor maior ou igual a 0.",
  },
  invalidLimit: {
    en: "parameter 'limit' is invalid. use a value greater than 0.",
    pt: "Parâmetro 'limit' inválido. use um valor maior que 0",
  },
  invalidValue: {
    en: "The ${key} provided is incorrect or does not exist in the database. Try:",
    pt: "O ${key} inserido está incorreto ou não existe no banco de dados. Tente:",
  },
  resultesFound: {
    en: "Exercises found:",
    pt: "Exercícios encontrados:",
  },
  noResults: {
    en: "No exercises found.",
    pt: "Nenhum exercício encontrado.",
  },
  noTranslation: {
    en: "Exercise not available in the selected language. Try:",
    pt: "Exercício não disponível no idioma selecionado. Tente:",
  },
  noSugestions: {
    en: "No suggestions available.",
    pt: "Nenhuma sugestão disponível.",
  },
  fetchError: {
    en: "Error fetching exercises.",
    pt: "Erro ao buscar os exercícios.",
  },
  searchError: {
    en: "Error searching exercises.",
    pt: "Erro ao buscar exercícios.",
  },
  notFoundImage: {
    en: "image not found in the database, check the name and try again",
    pt: "Imagem não encontrada no banco de dados, verifique o nome e tente novamente",
  },
};

const supportedLanguages = ["en", "pt"];
const defaultLanguage = "en";
const defaultPage = 0;
const defaultLimit = 50;

const validFields = [
  "force",
  "level",
  "mechanic",
  "equipment",
  "primaryMuscles",
  "secondaryMuscles",
  "instructions",
  "category",
  "images",
  "name",
];
const validFieldSet = new Set(validFields);

const filterableFields = [
  "primaryMuscles",
  "secondaryMuscles",
  "level",
  "force",
  "equipment",
  "category",
];

const languageSet = new Set(supportedLanguages);
const excludedExtractedValues = new Set(supportedLanguages);
const localizedExerciseFields = [
  "name",
  "force",
  "level",
  "mechanic",
  "equipment",
  "primaryMuscles",
  "secondaryMuscles",
  "instructions",
  "category",
];

const fuseOptions = {
  includeScore: true,
  threshold: 0.4,
  keys: ["name.en", "name.pt"],
};

const defaultImageFormatter = (exercise) => exercise.images;
const formatValidFields = () => `${validFields.join(", ")}.`;
const validationError = (message, extraBody = {}) => ({
  error: {
    status: 400,
    body: {
      message,
      ...extraBody,
    },
  },
});

const getHeaderLanguage = (acceptLanguage = "") =>
  acceptLanguage.split(",")[0]?.split("-")[0] || defaultLanguage;

const getErrorLanguage = (requestedLang, acceptLanguage) => {
  if (languageSet.has(requestedLang)) {
    return requestedLang;
  }

  const headerLanguage = getHeaderLanguage(acceptLanguage);
  return languageSet.has(headerLanguage) ? headerLanguage : defaultLanguage;
};

const parseLanguage = (requestedLang, acceptLanguage) => {
  const lang = requestedLang || defaultLanguage;

  if (!languageSet.has(lang)) {
    return validationError(
      errorMessages.invalidLang[getErrorLanguage(lang, acceptLanguage)],
    );
  }

  return { lang };
};

const parseFields = (rawFields, lang) => {
  if (rawFields === undefined) {
    return { fields: null };
  }

  if (rawFields === "") {
    return validationError(
      `${errorMessages.invalideParametters[lang]} ${formatValidFields()}`,
    );
  }

  const fields = rawFields.split(",").map((field) => field.trim());
  const invalidFields = fields.filter((field) => !validFieldSet.has(field));

  if (invalidFields.length > 0) {
    return validationError(
      `${errorMessages.invalidFields[lang]} ${formatValidFields()}`,
      {
        invalidFields,
      },
    );
  }

  return { fields };
};

const parsePagination = (pageParam, limitParam, lang) => {
  if (pageParam === "" || limitParam === "") {
    return validationError(errorMessages.invalideParamettersPageLimit[lang]);
  }

  const page = pageParam ? Number.parseInt(pageParam, 10) : defaultPage;
  const limit = limitParam ? Number.parseInt(limitParam, 10) : defaultLimit;

  if (pageParam && (!Number.isInteger(page) || page < 0)) {
    return validationError(errorMessages.invalidPage[lang]);
  }

  if (limitParam && (!Number.isInteger(limit) || limit < 1)) {
    return validationError(errorMessages.invalidLimit[lang]);
  }

  return { page, limit };
};

const extractValues = (data, lang) => {
  return data
    .flatMap((item) => {
      if (Array.isArray(item)) {
        return item;
      }
      if (item && typeof item === "object") {
        return item[lang];
      }
      return item;
    })
    .filter(
      (item) => typeof item === "string" && !excludedExtractedValues.has(item),
    );
};

const localizeValue = (value, lang) => {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value[lang] !== undefined
  ) {
    return value[lang];
  }

  return value;
};

const buildImagePaths = (exerciseId) => [
  `${exerciseId}/0.jpg`,
  `${exerciseId}/1.jpg`,
];

const setSerializedField = (result, exercise, field, lang, imageFormatter) => {
  if (field === "name") {
    return;
  }

  if (field === "images") {
    result.images = imageFormatter(exercise);
    return;
  }

  if (exercise[field] !== undefined) {
    result[field] = localizeValue(exercise[field], lang);
  }
};

const serializeSelectedFields = (exercise, lang, fields, imageFormatter) => {
  const result = {
    _id: exercise._id,
    name: localizeValue(exercise.name, lang),
  };

  fields.forEach((field) =>
    setSerializedField(result, exercise, field, lang, imageFormatter),
  );
  return result;
};

const serializeExercise = (exercise, lang, fields, options = {}) => {
  const imageFormatter = options.imageFormatter || defaultImageFormatter;

  if (fields) {
    return serializeSelectedFields(exercise, lang, fields, imageFormatter);
  }

  const serializedExercise = {
    ...exercise,
    _id: exercise._id,
    images: imageFormatter(exercise),
    id: exercise.id,
  };

  localizedExerciseFields.forEach((field) => {
    serializedExercise[field] = localizeValue(exercise[field], lang);
  });

  return serializedExercise;
};

module.exports = {
  buildImagePaths,
  defaultLanguage,
  errorMessages,
  extractValues,
  filterableFields,
  fuseOptions,
  getErrorLanguage,
  getHeaderLanguage,
  parseFields,
  parseLanguage,
  parsePagination,
  serializeExercise,
  supportedLanguages,
  validFields,
};
