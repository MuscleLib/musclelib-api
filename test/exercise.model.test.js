const assert = require("assert/strict");
const { describe, it } = require("node:test");

const Exercise = require("../api/Exercise");

const getPath = (path) => Exercise.schema.path(path);

describe("Exercise model schema", () => {
  it("exposes expected model name", () => {
    assert.equal(Exercise.modelName, "Exercise");
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
      assert.ok(schemaPath, `${path} is missing from schema`);
      assert.equal(schemaPath.instance, "String");
      assert.equal(schemaPath.options.required, true);
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
      assert.ok(schemaPath, `${path} is missing from schema`);
      assert.equal(schemaPath.instance, "Array");
      assert.ok(Array.isArray(schemaPath.options.type));
      assert.equal(schemaPath.options.type[0], String);
      assert.equal(schemaPath.options.required, true);
    }
  });

  it("defines images as required string array", () => {
    const schemaPath = getPath("images");
    assert.ok(schemaPath);
    assert.equal(schemaPath.instance, "Array");
    assert.ok(Array.isArray(schemaPath.options.type));
    assert.equal(schemaPath.options.type[0], String);
    assert.equal(schemaPath.options.required, true);
  });

  it("defines id as required unique string", () => {
    const schemaPath = getPath("id");
    assert.ok(schemaPath);
    assert.equal(schemaPath.instance, "String");
    assert.equal(schemaPath.options.required, true);
    assert.equal(schemaPath.options.unique, true);
  });
});
