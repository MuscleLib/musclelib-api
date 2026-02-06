const Fuse = require("fuse.js");

const Exercise = require("../../Exercise");
const { errorMessages, fuseOptions } = require("./shared");

module.exports = async (req, res) => {
  const { query, lang = "en", fields } = req.query;

  // Pegar o idioma do sistema (Accept-Language) caso lang seja inválido
  const userLang = req.headers["accept-language"]?.split(",")[0].split("-")[0]; // Exemplo: "es-ES" -> "es"

  // Se lang for inválido, tenta usar o idioma do sistema, senão, define "en" como padrão
  const selectedLang = ["en", "pt"].includes(lang)
    ? lang
    : ["en", "pt"].includes(userLang)
      ? userLang
      : "en";

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
    const filteredResults = results.filter((result) => result.item.name[lang]);

    if (filteredResults.length === 0) {
      return res.json({
        message: `${errorMessages.noTranslation[lang]} ${results[0].item.name.en}`,
      });
    }

    // Processar os resultados com os campos solicitados
    const fieldList = fields ? fields.split(",") : null;
    const matchedExercises = filteredResults.map((result) => {
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
};
