const Exercise = require("../../Exercise");

const { errorMessages, validFields, extractValues } = require("./shared");

module.exports = async (req, res) => {
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
      message: `${errorMessages.invalideParametters[lang]} ${validFields.join(", ")}.`,
    });
  }

  if (fields) {
    const invalidFields = fields.filter((field) => !validFields.includes(field));
    if (invalidFields.length > 0) {
      return res.status(400).json({
        message: `${errorMessages.invalidFields[lang] || errorMessages.invalidFields.en} ${validFields.join(", ")}.`,
        invalidFields,
      });
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
    const avaliableForces = extractValues(rawForces, lang);
    const avaliableLevels = extractValues(rawLevels, lang);
    const avaliableCategories = extractValues(rawCategories, lang);
    const avaliableEquipments = extractValues(rawEquipments, lang);
    const avaliablePrimaryMuscles = extractValues(rawPrimaryMuscles, lang);
    const avaliableSecondaryMuscles = extractValues(rawSecondaryMuscles, lang);

    const filters = {
      force: avaliableForces,
      level: avaliableLevels,
      category: avaliableCategories,
      equipment: avaliableEquipments,
      primaryMuscles: avaliablePrimaryMuscles,
      secondaryMuscles: avaliableSecondaryMuscles,
    };

    for (const [key, value] of Object.entries(req.query)) {
      if (!["lang", "fields", "page", "limit"].includes(key)) {
        if (
          [
            "primaryMuscles",
            "secondaryMuscles",
            "level",
            "force",
            "equipment",
            "category",
          ].includes(key)
        ) {
          if (!filters[key].includes(value)) {
            return res.status(400).json({
              message: errorMessages.invalidValue[lang].replace("${key}", key),
              avaliableOptions: filters[key],
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
        message: errorMessages.invalideParamettersPageLimit[lang],
      });
    }

    let page = req.query.page ? parseInt(req.query.page, 10) : 0;
    let limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

    if (req.query.page && (!Number.isInteger(page) || page < 0)) {
      return res.status(400).json({ message: errorMessages.invalidPage[lang] });
    }

    if (req.query.limit && (!Number.isInteger(limit) || limit < 1)) {
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
};
