jest.mock("../api/Translation", () => jest.fn());

const Translation = require("../api/Translation");
const { performance } = require("node:perf_hooks");
const { getTranslations, resetCache, TRANSLATION_TTL_MS } = require("../api/translationCache");
const deferred = require("./helpers/deferred");

describe("translation cache refresh", () => {
  let lean;
  let now;

  beforeEach(() => {
    resetCache();
    jest.clearAllMocks();
    now = 1000;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    lean = jest.fn().mockResolvedValue([
      { key: "example", translations: { en: "Original" } },
    ]);
    Translation.mockReturnValue({ find: () => ({ lean }) });
  });

  afterEach(() => jest.restoreAllMocks());

  it("reuses translations normally and reloads every collection on explicit refresh", async () => {
    const initial = await getTranslations();
    expect(await getTranslations()).toBe(initial);
    expect(lean).toHaveBeenCalledTimes(6);

    lean.mockResolvedValue([{ key: "example", translations: { en: "Updated" } }]);
    const refreshed = await getTranslations({ refresh: true });
    expect(refreshed.force_translations.example.en).toBe("Updated");
    expect(await getTranslations()).toBe(refreshed);
    expect(lean).toHaveBeenCalledTimes(12);
  });

  it("shares concurrent cold loads and expired refreshes", async () => {
    for (let load = 0; load < 2; load += 1) {
      const results = await Promise.all([getTranslations(), getTranslations(), getTranslations()]);
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
      now += TRANSLATION_TTL_MS;
    }
    expect(lean).toHaveBeenCalledTimes(12);
  });

  it("serves valid cached translations without waiting for a forced refresh", async () => {
    const initial = await getTranslations();
    const blocked = deferred();
    lean.mockReturnValue(blocked.promise);
    const refreshing = getTranslations({ refresh: true });
    const alsoRefreshing = getTranslations({ refresh: true });
    expect(await getTranslations()).toBe(initial);
    expect(lean).toHaveBeenCalledTimes(12);
    blocked.resolve([{ key: "example", translations: { en: "Updated" } }]);
    const results = await Promise.all([refreshing, alsoRefreshing]);
    expect(results[0]).toBe(results[1]);
    expect((await getTranslations()).force_translations.example.en).toBe("Updated");
  });

  it("refreshes at its own TTL boundary without any search traffic", async () => {
    const initial = await getTranslations();
    lean.mockResolvedValue([{ key: "example", translations: { en: "Updated" } }]);
    now += TRANSLATION_TTL_MS - 1;
    expect(await getTranslations()).toBe(initial);
    now += 1;
    expect((await getTranslations()).force_translations.example.en).toBe("Updated");
    expect(lean).toHaveBeenCalledTimes(12);
  });

  it("starts every independent collection read before waiting for completion", async () => {
    const blocked = deferred();
    const started = deferred();
    let reads = 0;
    lean.mockImplementation(() => {
      if (++reads === 6) started.resolve();
      return blocked.promise;
    });
    const pending = getTranslations();
    await started.promise;
    expect(lean).toHaveBeenCalledTimes(6);
    blocked.resolve([]);
    expect((await pending).force_translations).toEqual({});
  });

  it("starts the translation TTL after the whole snapshot has loaded", async () => {
    const blocked = deferred();
    lean.mockReturnValueOnce(blocked.promise);
    const pending = getTranslations();
    now += TRANSLATION_TTL_MS;
    blocked.resolve([]);
    const initial = await pending;
    now += TRANSLATION_TTL_MS - 1;
    expect(await getTranslations()).toBe(initial);
  });

  it("retries after a rejected refresh without caching the rejection", async () => {
    await getTranslations();
    lean.mockRejectedValueOnce(new Error("Translation read failed"));
    await expect(getTranslations({ refresh: true })).rejects.toThrow("Translation read failed");
    lean.mockResolvedValue([]);
    const refreshed = await getTranslations({ refresh: true });
    expect(refreshed.force_translations).toEqual({});
    expect(await getTranslations()).toBe(refreshed);
  });

  it("does not restore an old snapshot after reset during a pending load", async () => {
    let finish;
    lean.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = getTranslations();
    resetCache();
    lean.mockResolvedValue([]);
    const current = await getTranslations();
    finish([{ key: "example", translations: { en: "Discarded" } }]);
    await pending;
    expect(await getTranslations()).toBe(current);
    expect(current.force_translations).toEqual({});
  });

  it("rejects expired translations on failure and retries without extending their lifetime", async () => {
    await getTranslations();
    now += TRANSLATION_TTL_MS;
    lean.mockRejectedValueOnce(new Error("Translation read failed"));
    await expect(getTranslations()).rejects.toThrow("Translation read failed");
    lean.mockResolvedValue([{ key: "example", translations: { en: "Updated" } }]);
    expect((await getTranslations()).force_translations.example.en).toBe("Updated");
    expect(lean).toHaveBeenCalledTimes(18);
  });

  it("expires translations even if the system clock moves backwards", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1000);
    const initial = await getTranslations();
    Date.now.mockReturnValue(-3_600_000);
    now += TRANSLATION_TTL_MS;
    expect(await getTranslations()).not.toBe(initial);
  });
});
