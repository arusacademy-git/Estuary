import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      camelcase: "off",
      "@next/next/no-img-element": "off",
      "new-cap": ["error", { newIsCap: true, capIsNew: false }],
    },
  },

  // Performance override for the large dashboard component.
  {
    files: ["src/app/beta/dashboard/page.tsx"],
    rules: {
      "react-hooks/static-components": "off",
    },
  },

  globalIgnores([
    ".next/**",
    ".estuary-next/**",
    "out/**",
    "build/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
