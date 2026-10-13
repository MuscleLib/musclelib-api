const Fuse = require("fuse.js");
const { performance } = require("node:perf_hooks");

const Exercise = require("./Exercise");
const {
  getTranslations,
  resetCache: resetTranslations,
} = require("./translationCache");
const { fuseOptions, hydrateExercise } = require("./routes/exercises/shared");

const SEARCH_INDEX_TTL_MS = 60_000;
let cache = {};

const getSearchIndex = async () => {
  const current = cache;
  if (current.index && performance.now() < current.expiresAt) return current.index;
  if (current.pending) return current.pending;

  // Release expired documents before rebuilding. All languages share one index;
  // queries and serialized responses are never cached.
  current.index = null;
  current.pending = (async () => {
    const [translations, exercises] = await Promise.all([
      getTranslations(),
      Exercise.find().lean(),
    ]);
    const index = new Fuse(
      exercises.map((exercise) => hydrateExercise(exercise, translations)),
      fuseOptions,
    );

    current.index = index;
    current.expiresAt = performance.now() + SEARCH_INDEX_TTL_MS;
    return index;
  })();

  try {
    return await current.pending;
  } finally {
    current.pending = null;
  }
};

// Internal process-local invalidation: detach both caches so a new build cannot
// join a translation load started before reset. Detached requests may complete
// with their old snapshot, but cannot repopulate either active cache.
const resetSearchIndex = () => {
  cache = {};
  resetTranslations();
};

module.exports = { getSearchIndex, resetSearchIndex, SEARCH_INDEX_TTL_MS };
