const Translation = require("./Translation");

const COLLECTIONS = [
  "force_translations",
  "level_translations",
  "mechanic_translations",
  "equipment_translations",
  "category_translations",
  "muscle_translations",
];

let cache = null;

const getTranslations = async () => {
  if (cache) return cache;

  const result = {};
  for (const col of COLLECTIONS) {
    const model = Translation(col);
    const docs = await model.find().lean();
    result[col] = {};
    for (const doc of docs) {
      result[col][doc.key] = doc.translations;
    }
  }

  cache = result;
  return cache;
};

const resetCache = () => {
  cache = null;
};

module.exports = { getTranslations, resetCache };
