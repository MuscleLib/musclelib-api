const Exercise = require("../../api/Exercise");

const getPath = (path) => Exercise.schema.path(path);

describe("Exercise model schema", () => {
  it("exposes expected model name", () => {
    expect(Exercise.modelName).toBe("Exercise");
  });

  it("defines required localized string fields", () => {
    const requiredStringPaths = [
      "name.en",
      "name.pt",
      "force.en",
      "force.pt",
      "level.en",
      "level.pt",
      "mechanic.en",
      "mechanic.pt",
      "equipment.en",
      "equipment.pt",
      "category.en",
      "category.pt",
    ];

    for (const path of requiredStringPaths) {
      const schemaPath = getPath(path);
      expect(schemaPath).toBeTruthy();
      expect(schemaPath.instance).toBe("String");
      expect(schemaPath.options.required).toBe(true);
    }
  });

  it("defines required localized string arrays", () => {
    const requiredArrayPaths = [
      "primaryMuscles.en",
      "primaryMuscles.pt",
      "secondaryMuscles.en",
      "secondaryMuscles.pt",
      "instructions.en",
      "instructions.pt",
    ];

    for (const path of requiredArrayPaths) {
      const schemaPath = getPath(path);
      expect(schemaPath).toBeTruthy();
      expect(schemaPath.instance).toBe("Array");
      expect(Array.isArray(schemaPath.options.type)).toBe(true);
      expect(schemaPath.options.type[0]).toBe(String);
      expect(schemaPath.options.required).toBe(true);
    }
  });

  it("defines images as required string array", () => {
    const schemaPath = getPath("images");
    expect(schemaPath).toBeTruthy();
    expect(schemaPath.instance).toBe("Array");
    expect(Array.isArray(schemaPath.options.type)).toBe(true);
    expect(schemaPath.options.type[0]).toBe(String);
    expect(schemaPath.options.required).toBe(true);
  });

  it("defines id as required unique string", () => {
    const schemaPath = getPath("id");
    expect(schemaPath).toBeTruthy();
    expect(schemaPath.instance).toBe("String");
    expect(schemaPath.options.required).toBe(true);
    expect(schemaPath.options.unique).toBe(true);
  });
});
