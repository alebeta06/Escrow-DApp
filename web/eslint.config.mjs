import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // 🇪🇸 Los tests E2E (Playwright) tienen sus propias convenciones (fixtures, addInitScript en
      //    contexto navegador) y NO forman parte del lint de la app Next.
      "e2e/**",
    ],
  },
];

export default eslintConfig;
