const Translation = require("./Translation");
const { performance } = require("node:perf_hooks");
const { localizeTranslation } = require("./spanishVocabulary");

const COLLECTIONS = [
  "force_translations",
  "level_translations",
  "mechanic_translations",
  "equipment_translations",
  "category_translations",
  "muscle_translations",
];

const TRANSLATION_TTL_MS = 5 * 60_000;
let cache = {};

const loadTranslations = async () => {
  const entries = await Promise.all(
    COLLECTIONS.map(async (col) => {
      const docs = await Translation(col).find().lean();
      const translations = {};
      for (const doc of docs) {
        translations[doc.key] = localizeTranslation(col, doc);
      }
      return [col, translations];
    }),
  );
  return Object.fromEntries(entries);
};

const getTranslations = async ({ refresh = false } = {}) => {
  const current = cache;
  // A valid snapshot stays available to ordinary readers during a forced refresh.
  if (current.value && !refresh && performance.now() < current.expiresAt) {
    return current.value;
  }
  if (current.pending) return current.pending;

  current.pending = loadTranslations();
  try {
    current.value = await current.pending;
    current.expiresAt = performance.now() + TRANSLATION_TTL_MS;
    return current.value;
  } finally {
    current.pending = null;
  }
};

const resetCache = () => {
  cache = {};
};

module.exports = { getTranslations, resetCache, TRANSLATION_TTL_MS };
