/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'IBM Plex Mono'", "monospace"],
        display: ["'Fraunces'", "Georgia", "serif"],
      },
      colors: {
        coffee: {
          50:  "#FDF6ED",
          100: "#F7E7CC",
          200: "#EDCC99",
          300: "#DFA85A",
          400: "#C4622D",
          500: "#8B3A1A",
          600: "#6B2E14",
          700: "#4A1F0C",
          800: "#2C1810",
          900: "#1A0E08",
        },
      },
    },
  },
  plugins: [],
};
