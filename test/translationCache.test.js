jest.mock("../api/Translation", () => jest.fn());

const Translation = require("../api/Translation");
const { getTranslations, resetCache } = require("../api/translationCache");

describe("translation cache refresh", () => {
  let lean;

  beforeEach(() => {
    resetCache();
    jest.clearAllMocks();
    lean = jest.fn().mockResolvedValue([
      { key: "example", translations: { en: "Original" } },
    ]);
    Translation.mockReturnValue({ find: () => ({ lean }) });
  });

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

  it("shares concurrent loads and refreshes with ordinary readers", async () => {
    for (const refresh of [false, true]) {
      const results = await Promise.all([
        getTranslations({ refresh }),
        getTranslations({ refresh }),
        getTranslations(),
      ]);
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
    }
    expect(lean).toHaveBeenCalledTimes(12);
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
});
