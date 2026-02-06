const fs = require("fs");
const path = require("path");

const Fuse = require("fuse.js");
const Exercise = require("../../Exercise");
const { errorMessages } = require("./shared");

module.exports = async (req, res) => {
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
      const fuse = new Fuse(allExercises, {
        keys: ["id"],
        threshold: 0.4,
      });
      const suggestionResult = fuse.search(exerciseName, { limit: 1 });
      const suggestion = suggestionResult.length > 0 ? suggestionResult[0].item.id : null;

      return res.status(400).json({
        message: errorMessages.invalidValue[lang].replace("{key}", "exerciseName"),
        availableOptions: suggestion ? [suggestion] : [errorMessages.noSugestions[lang]],
      });
    }

    // Construir o caminho para a imagem, assumindo que as imagens estão em '../exercises/<exercise.id>/'
    const imagePath = path.join(
      __dirname,
      "../../../exercises",
      exercise.id,
      `${imageIndex}.jpg`
    );

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
};
