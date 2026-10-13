jest.mock("../api/translationCache");
jest.mock("fuse.js", () => {
  const Fuse = jest.requireActual("fuse.js");
  return jest.fn(function (documents, options) {
    return new Fuse(documents, options);
  });
});
jest.mock("../api/routes/exercises/shared", () => {
  const shared = jest.requireActual("../api/routes/exercises/shared");
  return { ...shared, hydrateExercise: jest.fn(shared.hydrateExercise) };
});

const Fuse = require("fuse.js");
const { performance } = require("node:perf_hooks");
const Exercise = require("../api/Exercise");
const { getTranslations } = require("../api/translationCache");
const { hydrateExercise } = require("../api/routes/exercises/shared");
const {
  getSearchIndex,
  resetSearchIndex,
  SEARCH_INDEX_TTL_MS,
} = require("../api/searchIndexCache");
const { buildExercise } = require("./fixtures/exercises.fixture");
const deferred = require("./helpers/deferred");

describe("exercise search index cache", () => {
  let now;
  let lean;

  beforeEach(() => {
    resetSearchIndex();
    jest.clearAllMocks();
    now = 1000;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    lean = jest.fn().mockResolvedValue([buildExercise()]);
    jest.spyOn(Exercise, "find").mockReturnValue({ lean });
    getTranslations.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  it("reuses the prepared documents and Fuse index until the exact TTL boundary", async () => {
    const initial = await getSearchIndex();
    now += SEARCH_INDEX_TTL_MS - 1;
    expect(await getSearchIndex()).toBe(initial);
    expect(Exercise.find).toHaveBeenCalledTimes(1);
    expect(getTranslations).toHaveBeenCalledTimes(1);
    expect(hydrateExercise).toHaveBeenCalledTimes(1);
    expect(Fuse).toHaveBeenCalledTimes(1);

    now += 1;
    expect(await getSearchIndex()).not.toBe(initial);
    expect(Exercise.find).toHaveBeenCalledTimes(2);
    expect(getTranslations).toHaveBeenNthCalledWith(2);
    expect(hydrateExercise).toHaveBeenCalledTimes(2);
    expect(Fuse).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent cold searches and expired refreshes", async () => {
    for (let build = 1; build <= 2; build += 1) {
      const started = deferred();
      const blocked = deferred();
      lean.mockImplementationOnce(() => {
        started.resolve();
        return blocked.promise;
      });
      const requests = [getSearchIndex(), getSearchIndex(), getSearchIndex()];
      await started.promise;
      expect(Exercise.find).toHaveBeenCalledTimes(build);
      blocked.resolve([buildExercise()]);
      const indexes = await Promise.all(requests);
      expect(indexes[1]).toBe(indexes[0]);
      expect(indexes[2]).toBe(indexes[0]);
      expect(Fuse).toHaveBeenCalledTimes(build);
      now += SEARCH_INDEX_TTL_MS;
    }
  });

  it("starts the lifetime after the build completes", async () => {
    lean.mockImplementationOnce(async () => {
      now += SEARCH_INDEX_TTL_MS;
      return [buildExercise()];
    });
    const initial = await getSearchIndex();
    now += SEARCH_INDEX_TTL_MS - 1;
    expect(await getSearchIndex()).toBe(initial);
    expect(Fuse).toHaveBeenCalledTimes(1);
  });

  it("replaces edited/deleted exercises and hydrated translations on refresh", async () => {
    getTranslations.mockResolvedValue({ equipment_translations: {
      kettlebells: { en: "Old equipment" },
    } });
    const initial = await getSearchIndex();
    expect(initial.search("Plyo")[0].item.equipment.en).toBe("Old equipment");

    lean.mockResolvedValue([buildExercise({ name: { en: "Zebra" } })]);
    getTranslations.mockResolvedValue({ equipment_translations: {
      kettlebells: { en: "Updated equipment" },
    } });
    now += SEARCH_INDEX_TTL_MS;
    const refreshed = await getSearchIndex();
    expect(refreshed.search("Plyo")).toEqual([]);
    expect(refreshed.search("Zebra")[0].item.equipment.en).toBe("Updated equipment");

    lean.mockResolvedValue([]);
    now += SEARCH_INDEX_TTL_MS;
    expect((await getSearchIndex()).search("Zebra")).toEqual([]);
  });

  it("caches an empty catalog and discovers additions after expiration", async () => {
    lean.mockResolvedValue([]);
    const empty = await getSearchIndex();
    expect(empty.search("Plyo")).toEqual([]);
    expect(await getSearchIndex()).toBe(empty);
    expect(Exercise.find).toHaveBeenCalledTimes(1);

    lean.mockResolvedValue([buildExercise()]);
    now += SEARCH_INDEX_TTL_MS;
    expect((await getSearchIndex()).search("Plyo")).toHaveLength(1);
  });

  it.each(["exercises", "translations"])(
    "shares a failed %s refresh, rejects expired data and allows retry",
    async (source) => {
      await getSearchIndex();
      now += SEARCH_INDEX_TTL_MS;
      const error = new Error("Database unavailable");
      if (source === "exercises") lean.mockRejectedValueOnce(error);
      else getTranslations.mockRejectedValueOnce(error);

      const results = await Promise.allSettled([getSearchIndex(), getSearchIndex()]);
      expect(results).toEqual([
        { status: "rejected", reason: error },
        { status: "rejected", reason: error },
      ]);
      expect(Fuse).toHaveBeenCalledTimes(1);
      expect((await getSearchIndex()).search("Plyo")).toHaveLength(1);
      expect(Fuse).toHaveBeenCalledTimes(2);
    },
  );

  it("invalidates a warm index immediately", async () => {
    const initial = await getSearchIndex();
    resetSearchIndex();
    expect(await getSearchIndex()).not.toBe(initial);
    expect(Exercise.find).toHaveBeenCalledTimes(2);
  });

  it("does not repopulate the active cache when reset during a pending build", async () => {
    const started = deferred();
    const blocked = deferred();
    lean.mockImplementationOnce(() => {
      started.resolve();
      return blocked.promise;
    });
    const pending = getSearchIndex();
    await started.promise;
    resetSearchIndex();
    const current = await getSearchIndex();
    blocked.resolve([buildExercise({ name: { en: "Zebra" } })]);
    const discarded = await pending;
    expect(discarded).not.toBe(current);
    expect(await getSearchIndex()).toBe(current);
    expect(current.search("Zebra")).toEqual([]);
  });

  it("starts reading exercises while translations are still pending", async () => {
    const translations = deferred();
    const exercisesStarted = deferred();
    getTranslations.mockReturnValueOnce(translations.promise);
    lean.mockImplementationOnce(() => {
      exercisesStarted.resolve();
      return Promise.resolve([buildExercise()]);
    });
    const pending = getSearchIndex();
    await exercisesStarted.promise;
    expect(Fuse).not.toHaveBeenCalled();
    translations.resolve({});
    expect((await pending).search("Plyo")).toHaveLength(1);
  });

  it("expires on elapsed time even if the system clock moves backwards", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1000);
    const initial = await getSearchIndex();
    Date.now.mockReturnValue(-3_600_000);
    now += SEARCH_INDEX_TTL_MS;
    expect(await getSearchIndex()).not.toBe(initial);
  });
});
