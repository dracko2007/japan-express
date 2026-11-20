import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      // Scripts antigos de troca de imagens (aposentados: o catálogo vive no Firestore). Montam regex em
      // template string com `\s`, que o JS reduz a `s`: já não funcionavam. Candidatos a remoção.
      "scripts/legacy/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Provedor + hook no mesmo arquivo é o padrão de contexto do React (e do shadcn/ui). O aviso só afeta
    // o hot reload em desenvolvimento; separar os hooks quebraria centenas de imports sem ganho real.
    files: ["src/context/**/*.{ts,tsx}", "src/components/ui/**/*.{ts,tsx}", "src/components/ConfirmDialog.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
