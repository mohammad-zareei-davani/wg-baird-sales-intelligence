/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F6F3",
        ink: "#16161A",
        mid: "#6B6B70",
        cyan: "#0B7FA8",
        magenta: "#B0245E",
        ochre: "#B8860B",
        rule: "#D8D6D0",
      },
      fontFamily: {
        head: ["Archivo", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
      },
    },
  },
  plugins: [],
};
