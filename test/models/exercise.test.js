const Exercise = require("../../api/Exercise");

const getPath = (path) => Exercise.schema.path(path);

describe("Exercise model schema", () => {
  it("exposes expected model name", () => {
    expect(Exercise.modelName).toBe("Exercise");
  });

  it("defines required localized string fields for name", () => {
    for (const path of ["name.en", "name.pt"]) {
      const schemaPath = getPath(path);
      expect(schemaPath).toBeTruthy();
      expect(schemaPath.instance).toBe("String");
      expect(schemaPath.options.required).toBe(true);
    }
  });

  it("defines enumerable fields as required plain strings", () => {
    for (const field of ["force", "level", "mechanic", "equipment", "category"]) {
      const schemaPath = getPath(field);
      expect(schemaPath).toBeTruthy();
      expect(schemaPath.instance).toBe("String");
      expect(schemaPath.options.required).toBe(true);
    }
  });

  it("defines muscle arrays as required plain string arrays", () => {
    for (const field of ["primaryMuscles", "secondaryMuscles"]) {
      const schemaPath = getPath(field);
      expect(schemaPath).toBeTruthy();
      expect(schemaPath.instance).toBe("Array");
      expect(Array.isArray(schemaPath.options.type)).toBe(true);
      expect(schemaPath.options.type[0]).toBe(String);
      expect(schemaPath.options.required).toBe(true);
    }
  });

  it("defines instructions as required localized string arrays", () => {
    for (const path of ["instructions.en", "instructions.pt"]) {
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
