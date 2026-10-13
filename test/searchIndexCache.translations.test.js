jest.mock("../api/Translation", () => jest.fn());

const Exercise = require("../api/Exercise");
const Translation = require("../api/Translation");
const { performance } = require("node:perf_hooks");
const { getTranslations, TRANSLATION_TTL_MS } = require("../api/translationCache");
const { getSearchIndex, resetSearchIndex, SEARCH_INDEX_TTL_MS } = require("../api/searchIndexCache");
const { buildExercise } = require("./fixtures/exercises.fixture");
const deferred = require("./helpers/deferred");

describe("search index and translation cache invalidation", () => {
  let now;
  beforeEach(() => {
    resetSearchIndex();
    jest.clearAllMocks();
    now = 1000;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    jest.spyOn(Exercise, "find").mockReturnValue({
      lean: async () => [buildExercise()],
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("reloads translations after reset while an earlier translation load is pending", async () => {
    const blocked = deferred();
    const started = deferred();
    let equipment = "Old equipment";
    let muscleReads = 0;
    Translation.mockImplementation((collection) => ({
      find: () => ({
        lean: async () => {
          if (collection === "equipment_translations") {
            return [{ key: "kettlebells", translations: { en: equipment } }];
          }
          if (collection === "muscle_translations" && muscleReads++ === 0) {
            started.resolve();
            return blocked.promise;
          }
          return [];
        },
      }),
    }));

    const pending = getSearchIndex();
    await started.promise;
    equipment = "Updated equipment";
    resetSearchIndex();
    const rebuilding = getSearchIndex();
    blocked.resolve([]);
    const [discarded, current] = await Promise.all([pending, rebuilding]);

    expect(discarded.search("Plyo")[0].item.equipment.en).toBe("Old equipment");
    expect(current.search("Plyo")[0].item.equipment.en).toBe("Updated equipment");
    expect(await getSearchIndex()).toBe(current);
    expect((await getTranslations()).equipment_translations.kettlebells.en).toBe("Updated equipment");
  });

  it("rebuilds exercises without reloading still-valid translation collections", async () => {
    const lean = jest.fn().mockResolvedValue([]);
    Translation.mockReturnValue({ find: () => ({ lean }) });
    const initial = await getSearchIndex();
    now += SEARCH_INDEX_TTL_MS;
    expect(await getSearchIndex()).not.toBe(initial);
    expect(Exercise.find).toHaveBeenCalledTimes(2);
    expect(lean).toHaveBeenCalledTimes(6);

    now = 1000 + TRANSLATION_TTL_MS;
    await getSearchIndex();
    expect(lean).toHaveBeenCalledTimes(12);
  });

  it("uses refreshed listing translations on the next index rebuild", async () => {
    let equipment = "Old equipment";
    Translation.mockImplementation((collection) => ({
      find: () => ({ lean: async () => collection === "equipment_translations"
        ? [{ key: "kettlebells", translations: { en: equipment } }] : [] }),
    }));
    await getSearchIndex();
    now += TRANSLATION_TTL_MS - 1;
    const index = await getSearchIndex();
    equipment = "Updated equipment";
    now += 1;
    expect((await getTranslations()).equipment_translations.kettlebells.en).toBe("Updated equipment");
    expect(await getSearchIndex()).toBe(index);
    now += SEARCH_INDEX_TTL_MS;
    expect((await getSearchIndex()).search("Plyo")[0].item.equipment.en).toBe("Updated equipment");
  });
});
