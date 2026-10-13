const Translation = require("./Translation");
const { localizeTranslation } = require("./spanishVocabulary");

const COLLECTIONS = [
  "force_translations",
  "level_translations",
  "mechanic_translations",
  "equipment_translations",
  "category_translations",
  "muscle_translations",
];

let cache = {};

const loadTranslations = async () => {
  const result = {};
  for (const col of COLLECTIONS) {
    const model = Translation(col);
    const docs = await model.find().lean();
    result[col] = {};
    for (const doc of docs) {
      result[col][doc.key] = localizeTranslation(col, doc);
    }
  }

  return result;
};

const getTranslations = async ({ refresh = false } = {}) => {
  const current = cache;
  if (current.pending) return current.pending;
  if (current.value && !refresh) return current.value;

  current.pending = loadTranslations();
  try {
    current.value = await current.pending;
    return current.value;
  } finally {
    current.pending = null;
  }
};

const resetCache = () => {
  cache = {};
};

module.exports = { getTranslations, resetCache };
