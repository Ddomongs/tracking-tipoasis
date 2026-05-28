import type { Config } from "tailwindcss";

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
        background: "hsl(222, 47%, 6%)",
        foreground: "hsl(210, 40%, 98%)",
        card: "hsl(220, 30%, 12%)",
        cardForeground: "hsl(210, 40%, 98%)",
        border: "hsl(217, 22%, 24%)",
        muted: "hsl(217, 15%, 20%)",
        mutedForeground: "hsl(215, 20%, 72%)",
        accent: {
          success: "hsl(156, 100%, 42%)",
          warning: "hsl(38, 100%, 64%)",
          info: "hsl(195, 85%, 62%)",
          error: "hsl(0, 100%, 71%)"
        }
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem"
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
