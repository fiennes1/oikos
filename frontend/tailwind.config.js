/** @type {import('tailwindcss').Config} */
export default {
  /* Mais confiável que só .dark: alterna com data-theme no <html> */
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Bebas Neue", "system-ui", "sans-serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#15803d",
          light: "#22c55e",
          dark: "#052e16",
          deeper: "#022c17",
        },
      },
    },
  },
  plugins: [],
};
