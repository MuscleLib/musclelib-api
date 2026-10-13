const Fuse = require("fuse.js");

const Exercise = require("./Exercise");
const { getTranslations } = require("./translationCache");
const { fuseOptions, hydrateExercise } = require("./routes/exercises/shared");

const SEARCH_INDEX_TTL_MS = 60_000;
let cache = {};

const getSearchIndex = async () => {
  const current = cache;
  if (current.index && Date.now() < current.expiresAt) return current.index;
  if (current.pending) return current.pending;

  // Release expired documents before rebuilding. All languages share one index;
  // queries and serialized responses are never cached.
  current.index = null;
  current.pending = (async () => {
    const translations = await getTranslations({ refresh: true });
    const exercises = await Exercise.find().lean();
    const index = new Fuse(
      exercises.map((exercise) => hydrateExercise(exercise, translations)),
      fuseOptions,
    );

    current.index = index;
    current.expiresAt = Date.now() + SEARCH_INDEX_TTL_MS;
    return index;
  })();

  try {
    return await current.pending;
  } finally {
    current.pending = null;
  }
};

// Replacing the state also prevents a pending build from repopulating this cache.
const resetSearchIndex = () => {
  cache = {};
};

module.exports = { getSearchIndex, resetSearchIndex, SEARCH_INDEX_TTL_MS };
