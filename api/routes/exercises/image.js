const fs = require("fs");
const path = require("path");

const Fuse = require("fuse.js");
const Exercise = require("../../Exercise");
const { errorMessages, getHeaderLanguage, supportedLanguages } = require("./shared");

module.exports = async (req, res) => {
  const { exerciseName, imageIndex } = req.params;

  const userLang = getHeaderLanguage(req.headers["accept-language"]);
  const lang = supportedLanguages.includes(userLang) ? userLang : "en";

  try {
    const exercise = await Exercise.findOne({ id: exerciseName }).lean();

    if (!exercise) {
      const allExercises = await Exercise.find().lean();
      const fuse = new Fuse(allExercises, {
        keys: ["id"],
        threshold: 0.4,
      });
      const suggestionResult = fuse.search(exerciseName, { limit: 1 });
      const suggestion = suggestionResult.length > 0 ? suggestionResult[0].item.id : null;

      return res.status(400).json({
        message: errorMessages.invalidValue[lang].replace("${key}", "exerciseName"),
        availableOptions: suggestion ? [suggestion] : [errorMessages.noSugestions[lang]],
      });
    }

    const imagePath = path.join(
      __dirname,
      "../../../exercises",
      exercise.id,
      `${imageIndex}.jpg`
    );

    if (!fs.existsSync(imagePath)) {
      return res.status(400).json({
        message: errorMessages.notFoundImage[lang],
      });
    }

    res.sendFile(imagePath);
  } catch (err) {
    console.error(`${errorMessages.fetchError[lang]}: ${err.message}`);
    res.status(500).json({
      message: errorMessages.fetchError[lang],
      error: err.message,
    });
  }
};
