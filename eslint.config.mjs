import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Brand rules from the spec, enforced in code review by the linter instead of by memory.
const EMOJI = /\p{Extended_Pictographic}/u;
const ALLOWED_SYMBOLS = /[©®™]/gu; // ©, ®, ™ are text symbols, not emoji
const HEX_COLOR = /(^|[^\w&/])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const PALETTE_CLASS =
  /(^|[\s:"'`])-?(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?(?:\/\d+)?(?=$|[\s"'`])/;

function textRule(test, messageId) {
  return (context) => {
    const check = (node, text) => {
      if (typeof text === "string" && test(text)) context.report({ node, messageId });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.raw),
      JSXText: (node) => check(node, node.value),
    };
  };
}

const tezdukan = {
  rules: {
    "no-emoji": {
      meta: {
        type: "problem",
        messages: { emoji: "Emoji are not allowed anywhere. Use a Lucide icon with a label." },
      },
      create: textRule((t) => EMOJI.test(t.replace(ALLOWED_SYMBOLS, "")), "emoji"),
    },
    "no-raw-colors": {
      meta: {
        type: "problem",
        messages: {
          color:
            "Use design tokens (bg-primary, text-ink, border-border, …) instead of hex values or Tailwind palette colours.",
        },
      },
      create: textRule((t) => HEX_COLOR.test(t) || PALETTE_CLASS.test(t), "color"),
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { tezdukan },
    rules: {
      "tezdukan/no-emoji": "error",
      "tezdukan/no-raw-colors": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: false,
          ignoreProps: true,
          allowedStrings: [
            "·",
            "/",
            "-",
            "–",
            "—",
            "×",
            "+",
            "−",
            "%",
            ":",
            "(",
            ")",
            "|",
            "…",
            "Ctrl",
            "K",
            "Esc",
            "↵",
            "⌘",
          ],
        },
      ],
    },
  },
  {
    // Brand colours are defined once for non-CSS consumers (manifest, PDFs, map markers).
    files: [
      "src/lib/brand/**",
      "src/components/brand/logo.tsx",
      "src/app/manifest.ts",
      "src/app/**/dev/**",
      "scripts/**",
    ],
    rules: { "tezdukan/no-raw-colors": "off" },
  },
  {
    // UI copy rule applies to app UI only; tests, scripts and the dev catalogue are exempt.
    files: [
      "**/*.test.{ts,tsx}",
      "e2e/**",
      "scripts/**",
      "supabase/**",
      "src/app/**/dev/**",
      "src/app/serwist/**",
    ],
    rules: { "react/jsx-no-literals": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "messages/*.d.json.ts",
    "src/lib/supabase/database.types.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
