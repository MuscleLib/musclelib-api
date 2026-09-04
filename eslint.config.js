const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");

const nodeGlobals = {
  __dirname: "readonly",
  Buffer: "readonly",
  console: "readonly",
  global: "readonly",
  module: "readonly",
  process: "readonly",
  require: "readonly",
};

const jestGlobals = {
  afterAll: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  jest: "readonly",
  test: "readonly",
};

// Globals provided by the mongosh runtime (scripts/ are run with mongosh --file).
const mongoshGlobals = {
  db: "readonly",
  print: "readonly",
  quit: "readonly",
};

module.exports = [
  {
    ignores: ["coverage/**", "dest/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
  },
  {
    files: ["test/**/*.js", "**/*.test.js", "**/*.spec.js"],
    languageOptions: {
      globals: jestGlobals,
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: mongoshGlobals,
    },
  },
  prettier,
];
