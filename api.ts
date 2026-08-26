/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#0F1113",
          900: "#15181B",
          800: "#1C2024",
          700: "#262B30",
          600: "#343B42",
          500: "#4A535C",
        },
        gold: {
          400: "#E4C069",
          500: "#C9A24B",
          600: "#A8813A",
        },
        status: {
          success: "#3FA34D",
          successBg: "#16261A",
          warning: "#E8A93B",
          warningBg: "#2A2114",
          critical: "#E5555A",
          criticalBg: "#2B1616",
          info: "#5A9BD8",
          infoBg: "#141F2A",
        },
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
}
