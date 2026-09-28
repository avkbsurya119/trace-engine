import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "grow-x": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        "grow-x": "grow-x 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      colors: {
        // Deep navy color palette (matching liquid glass theme)
        industrial: {
          50: "#e8ecf4",
          100: "#c4cce0",
          200: "#9aa8c8",
          300: "#7085b0",
          400: "#506a9c",
          500: "#3b5280",
          600: "#2d4068",
          700: "#1e2d4a",
          800: "#131d33",
          900: "#0a1628",
          950: "#04060f",
        },
        // Navy glass backgrounds
        navy: {
          base: "#090d24",
          card: "rgba(16, 24, 56, 0.38)",
          panel: "rgba(12, 19, 46, 0.55)",
          deep: "#04060f",
        },
        status: {
          success: "#22c55e",
          partial: "#f59e0b",
          failed: "#ef4444",
          unknown: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;
