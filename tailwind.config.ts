import type { Config } from "tailwindcss";
import { COLOR_TOKENS } from "./lib/style/tokens";

/** "--tt-ground" → "ground", "--tt-tone-progress-on" → "progress-on" (classes bg-tt-ground, text-tt-progress-on). */
const ttColors: Record<string, string> = Object.fromEntries(
  COLOR_TOKENS.map((token) => [token.replace(/^--tt-(tone-)?/, ""), `var(${token})`])
);

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        tt: ttColors
      },
      fontFamily: {
        "tt-body": "var(--tt-font-body)",
        "tt-display": "var(--tt-font-display)",
        "tt-mono": "var(--tt-font-mono)"
      },
      fontSize: {
        "tt-xs": ["var(--tt-text-xs)", { lineHeight: "18px" }],
        "tt-sm": ["var(--tt-text-sm)", { lineHeight: "20px" }],
        "tt-md": ["var(--tt-text-md)", { lineHeight: "24px" }],
        "tt-lg": ["var(--tt-text-lg)", { lineHeight: "28px" }],
        "tt-xl": ["var(--tt-text-xl)", { lineHeight: "32px" }],
        "tt-eta": ["var(--tt-text-eta)", { lineHeight: "1.1" }]
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
        "tt-button": "var(--tt-radius-button)",
        "tt-card": "var(--tt-radius-card)"
      },
      transitionDuration: {
        "tt-fast": "var(--tt-motion-fast)",
        "tt-base": "var(--tt-motion-base)",
        "tt-slow": "var(--tt-motion-slow)"
      },
      transitionTimingFunction: {
        tt: "var(--tt-ease)"
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(16, 185, 129, 0)" }
        }
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
