module.exports = {
  root: true,
  env: { node: true, es2021: true },

  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },

  plugins: ["@typescript-eslint"],

  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],

  ignorePatterns: [
    "lib/**",
    "node_modules/**",
    "functions/**", // 🔥 blocks the nested functions/functions folder path from breaking lint
  ],
};
