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

const fuseOptions = {
  includeScore: true,
  threshold: 0.4,
  keys: ["name.en", "name.pt"],
};

const extractValues = (data, lang) => {
  return data
    .flatMap((item) => {
      if (Array.isArray(item)) {
        return item;
      }
      if (typeof item === "object") {
        return item[lang];
      }
      return item;
    })
    .filter((item) => typeof item === "string" && item !== "en" && item !== "pt");
};

module.exports = {
  errorMessages,
  validFields,
  fuseOptions,
  extractValues,
};
