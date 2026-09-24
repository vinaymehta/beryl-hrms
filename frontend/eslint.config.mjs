import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

// Every password field in the app shows the same eye toggle, and the only way
// to keep that true as the app grows is to make the alternative fail the
// build. A raw `type="password"` renders a field with no reveal control, which
// is how the inconsistency crept in before: nobody decides to leave the toggle
// out, they just reach for <Input> without thinking about it.
//
// PasswordInput is exempt because it is the thing being pointed at.
const PASSWORD_INPUT_RULE = {
  "no-restricted-syntax": [
    "error",
    {
      selector: 'JSXAttribute[name.name="type"][value.value="password"]',
      message:
        "Use <PasswordInput> from @/components/ui/password-input instead of a raw password field — " +
        "it carries the show/hide toggle every password field in the app is expected to have.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/password-input.tsx"],
    rules: PASSWORD_INPUT_RULE,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
