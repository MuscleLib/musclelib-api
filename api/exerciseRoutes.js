const fs = require("fs");
const path = require("path");
const express = require("express");
const Fuse = require("fuse.js");
const router = express.Router();
const Exercise = require("./Exercise");

// Configurações do Fuse.js
const fuseOptions = {
  includeScore: true,
  threshold: 0.4,
  keys: ["name.en", "name.pt"],
};

// Mensagens de erro localizadas
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
  noSugestions:{
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

// Lista de campos válidos
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

// Endpoint para obter exercícios com filtros dinâmicos e campos opcionais
router.get("/", async (req, res) => {
  const lang = req.query.lang || "en";
  const fields = req.query.fields ? req.query.fields.split(",") : null;
  const query = {};

  // Validar paremettro 'lang
  if (!["en", "pt"].includes(lang)) {
    return res
      .status(400)
      .json({ message: errorMessages.invalidLang[lang] });
  }

  // Validar parametros 'fields'
  if (req.query.fields === "") {
    return res.status(400).json({
      message: `${errorMessages.invalideParametters[lang] } ${validFields.join(", ")}.`,
    });
  }

  if (fields) {
    const invalidFields = fields.filter((field) => !validFields.includes(field));
    if (invalidFields.length > 0) {
      return res.status(400).json({
        message: `${errorMessages.invalidFields[lang] || errorMessages.invalidFields.en} ${validFields.join(", ")}.`,
        invalidFields,
      })
    }
  }


  // Filtros dinâmicos
  try {
    // Obter valores únicos do banco de dados para validação
    const rawForces = await Exercise.distinct("force");
    const rawLevels = await Exercise.distinct("level");
    const rawCategories = await Exercise.distinct("category");
    const rawEquipments = await Exercise.distinct("equipment");
    const rawPrimaryMuscles = await Exercise.distinct(`primaryMuscles.${lang}`);
    const rawSecondaryMuscles = await Exercise.distinct(`secondaryMuscles.${lang}`);

  // Função para extrair valores e garantir que não retornem 'en'
  const extractValues = (data) => {
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

  const avaliableForces = extractValues(rawForces);
  const avaliableLevels = extractValues(rawLevels);
  const avaliableCategories = extractValues(rawCategories);
  const avaliableEquipments = extractValues(rawEquipments);
  const avaliablePrimaryMuscles = extractValues(rawPrimaryMuscles);
  const avaliableSecondaryMuscles = extractValues(rawSecondaryMuscles);

  const filters = {
    force: avaliableForces,
    level: avaliableLevels,
    category: avaliableCategories,
    equipment: avaliableEquipments,
    primaryMuscles: avaliablePrimaryMuscles,
    secondaryMuscles: avaliableSecondaryMuscles
  };

  for (const [key, value] of Object.entries(req.query)) {
    if (!["lang", "fields", "page", "limit"].includes(key)) {
      if (["primaryMuscles", "secondaryMuscles", "level", "force", "equipment", "category"].includes(key)) {
        if (!filters[key].includes(value)) {
          return res.status(400).json({
            message: errorMessages.invalidValue[lang].replace("${key}", key),
            avaliableOptions: filters[key]
          });
        }
        query[`${key}.${lang}`] = new RegExp(`^${value}`, "i");
      } else {
        query[key] = value; // Outros filtros
      }
    }
  }

  const exercise = await Exercise.findOne(query).lean();
  if (!exercise) {
    return res.status(404).json({
      message: errorMessages.noResults[lang],
    });
  }

    // Validação para 'page' e 'limit'
    if (req.query.page == "" || req.query.limit == "") {
      return res.status(400).json({
        message: errorMessages.invalideParamettersPageLimit[lang]
      });
    }

    let page = req.query.page ? parseInt(req.query.page, 10) : 0;
    let limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

    if (
      (req.query.page && (!Number.isInteger(page) || page < 0))
    ) {
      return res.status(400).json({ message: errorMessages.invalidPage[lang] });
    };

    if (
      (req.query.limit && (!Number.isInteger(limit) || limit < 1))
    ) {
      return res.status(400).json({ message: errorMessages.invalidLimit[lang] });
    }

    page = page || 0;
    limit = limit || 50;

    const exercises = await Exercise.find(query)
      .skip(page * limit)
      .limit(limit)
      .lean();

    if (exercises.length === 0) {
      return res.status(404).json({
        message: errorMessages.noResults[lang],
      });
    }

    const formattedExercises = exercises.map((exercise) => {
      if (fields) {
        // Retorna apenas os campos especificados em 'fields'
        const result = {
          _id: exercise._id,
          name: exercise.name[lang],
        };

        fields.forEach((field) => {
          if (exercise[field]) {
            result[field] = exercise[field][lang] || exercise[field];
          }
        });

        return result;
      }

      // Retorna todos os campos se 'fields' não estiver presente
      return {
        ...exercise,
        _id: exercise._id,
        name: exercise.name[lang],
        force: exercise.force[lang],
        level: exercise.level[lang],
        mechanic: exercise.mechanic[lang],
        equipment: exercise.equipment[lang],
        primaryMuscles: exercise.primaryMuscles[lang],
        secondaryMuscles: exercise.secondaryMuscles[lang],
        instructions: exercise.instructions[lang],
        category: exercise.category[lang],
        images: exercise.images,
        id: exercise.id,
      };
    });

    res.json(formattedExercises);
  } catch (err) {
  res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
});

// Endpoint para buscar exercícios com sugestões de correção e tradução
router.get("/search", async (req, res) => {
  const { query, lang = "en", fields } = req.query;

  // Pegar o idioma do sistema (Accept-Language) caso lang seja inválido
  let userLang = req.headers["accept-language"]?.split(",")[0].split("-")[0]; // Exemplo: "es-ES" -> "es"

  // Se lang for inválido, tenta usar o idioma do sistema, senão, define "en" como padrão
  const selectedLang = ["en", "pt"].includes(lang) ? lang : (["en", "pt"].includes(userLang) ? userLang : "en");

  // Se o idioma for inválido, retorna o erro na linguagem correta
  if (!["en", "pt"].includes(lang)) {
    return res.status(400).json({ message: errorMessages.invalidLang[selectedLang] });
  }

  // Validar termo de busca
  if (!query) {
    return res.status(400).json({ message: errorMessages.missingQuery[lang] });
  }

  try {
    // Recuperar todos os exercícios
    const exercises = await Exercise.find().lean();

    // Configurar Fuse.js para busca
    const fuse = new Fuse(exercises, fuseOptions);
    const results = fuse.search(query);

    // Se não houver correspondência, sugerir um nome parecido
    if (results.length === 0) {
      const closestMatch = fuse.search(query, { limit: 1 })[0];
      return res.json({
        message: `${errorMessages.noResults[lang]} ${closestMatch ? closestMatch.item.name[lang] : `${errorMessages.noSugestions[lang]}`}`,
      });
    }

    // Verificar se o exercício está disponível no idioma solicitado
    const filteredResults = results.filter(result => result.item.name[lang]);

    if (filteredResults.length === 0) {
      return res.json({
        message: `${errorMessages.noTranslation[lang]} ${results[0].item.name.en}`,
      });
    }

    // Processar os resultados com os campos solicitados
    const fieldList = fields ? fields.split(",") : null;
    const matchedExercises = filteredResults.map(result => {
      const exercise = result.item;
      const response = { _id: exercise._id, name: exercise.name[lang] };

      if (!fieldList || fieldList.includes("force")) {
        response.force = exercise.force[lang];
      }
      if (!fieldList || fieldList.includes("level")) {
        response.level = exercise.level[lang];
      }
      if (!fieldList || fieldList.includes("mechanic")) {
        response.mechanic = exercise.mechanic[lang];
      }
      if (!fieldList || fieldList.includes("equipment")) {
        response.equipment = exercise.equipment[lang];
      }
      if (!fieldList || fieldList.includes("primaryMuscles")) {
        response.primaryMuscles = exercise.primaryMuscles[lang];
      }
      if (!fieldList || fieldList.includes("secondaryMuscles")) {
        response.secondaryMuscles = exercise.secondaryMuscles[lang];
      }
      if (!fieldList || fieldList.includes("instructions")) {
        response.instructions = exercise.instructions[lang];
      }
      if (!fieldList || fieldList.includes("category")) {
        response.category = exercise.category[lang];
      }
      if (!fieldList || fieldList.includes("images")) {
        response.images = [
          `/exercises/${exercise.id}/0.jpg`,
          `/exercises/${exercise.id}/1.jpg`,
        ];
      }

      return response;
    });

    res.json({ exercises: matchedExercises });
  } catch (err) {
    console.error(`${errorMessages.searchError[lang]}: ${err.message}`);
    res.status(500).json({
      message: errorMessages.searchError[lang],
      error: err.message,
    });
  }
});

// Endpoint para servir imagens de exercícios com tratamento de erro personalizado
router.get("/:exerciseName/:imageIndex.jpg", async (req, res) => {
  const { exerciseName, imageIndex } = req.params;

  // Detecta o idioma do usuário a partir do cabeçalho "Accept-Language"
  const acceptedLanguages = req.headers["accept-language"] || "";
  const userLang = acceptedLanguages.split(",")[0].split("-")[0]; 
  
    // Define o idioma padrão
  const lang = ["en", "pt"].includes(userLang) ? userLang : "en";

  try {
    // Procurar o exercício pelo campo 'id' (assumindo que 'exerciseName' corresponde ao campo 'id')
    const exercise = await Exercise.findOne({ id: exerciseName }).lean();

    if (!exercise) {
      // Se não encontrar, usar Fuse.js para sugerir um nome semelhante
      const allExercises = await Exercise.find().lean();
      const fuse = new Fuse(allExercises, { keys: ["id"], threshold: 0.4 });
      const suggestionResult = fuse.search(exerciseName, { limit: 1 });
      const suggestion = suggestionResult.length > 0 ? suggestionResult[0].item.id : null;
      
      return res.status(400).json({
        message: errorMessages.invalidValue[lang].replace("{key}", "exerciseName"),
        availableOptions: suggestion ? [suggestion] : [errorMessages.noSugestions[lang]],
      });
    }

    // Construir o caminho para a imagem, assumindo que as imagens estão em '../exercises/<exercise.id>/'
    const imagePath = path.join(__dirname, "../exercises", exercise.id, `${imageIndex}.jpg`);

    // Verificar se o arquivo existe
    if (!fs.existsSync(imagePath)) {
      return res.status(400).json({
        message: errorMessages.notFoundImage[lang],
      });
    }

    // Se existir, enviar o arquivo
    res.sendFile(imagePath);
  } catch (err) {
    console.error(`${errorMessages.fetchError[lang]}: ${err.message}`);
    res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
});

module.exports = router;
