import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Globally ignore folders that contain generated or build artifacts
  {
    ignores: [
      "lib/generated/**", // Prisma client bundles and WASM
      "node_modules/**",
      ".next/**",
      "public/**",
      "./app/components/dot-grid.tsx",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Allow usage of `any` type across the codebase
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Keep a fallback override for generated code in case they slip through (not strictly needed once ignored)
  {
    files: ["lib/generated/**"],
    rules: {
      all: "off",
    },
  },
];

export default eslintConfig;
