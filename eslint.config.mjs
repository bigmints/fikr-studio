import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["node_modules/**", ".next/**", "out/**", "dist/**", "build/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // React hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // TypeScript
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "warn",          // downgrade to warn — legacy codebase
      // General
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],     // empty catch blocks are intentional silencers
      "prefer-const": "error",
      "no-useless-assignment": "error",
    },
  },
  // CommonJS Node.js files (main process, firestore layer, scripts)
  // cannot use ESM imports — exempt them from the require() rule.
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
