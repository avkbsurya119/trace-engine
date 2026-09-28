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
        // Industrial color palette
        industrial: {
          50: "#f4f7f7",
          100: "#e2ebea",
          200: "#c8d9d7",
          300: "#a1bfbc",
          400: "#739d99",
          500: "#58817e",
          600: "#466968",
          700: "#3b5656",
          800: "#334748",
          900: "#2d3d3e",
          950: "#192526",
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
