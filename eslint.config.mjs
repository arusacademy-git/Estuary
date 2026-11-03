import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Large components that are slow under the React Compiler lint rules.
const HEAVY_FILES = [
  "src/app/beta/dashboard/page.tsx",
  "src/features/payment-request/components/claims/claim-form.tsx",
];

// Every react-hooks rule except the two classic ones runs the React Compiler.
// Read the rule names from the plugin itself so this works with your installed version.
const reactHooksPlugin = nextVitals.find((config) => config.plugins?.["react-hooks"])
  ?.plugins["react-hooks"];

const compilerRulesOff = Object.fromEntries(
  Object.keys(reactHooksPlugin?.rules ?? {})
    .filter((name) => name !== "rules-of-hooks" && name !== "exhaustive-deps")
    .map((name) => [`react-hooks/${name}`, "off"]),
);

const isCI = process.env.CI === "true";

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

  // Performance: skip React Compiler checks for heavy files in the editor only.
  // CI (CI=true) still runs the full rule set.
  ...(isCI
    ? []
    : [
        {
          files: HEAVY_FILES,
          rules: compilerRulesOff,
        },
      ]),

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
