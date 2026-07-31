/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: "#f4f4f1",
        surface: "#fcfcfb",
        raised: "#ffffff",
        ink: {
          primary: "#0b0b0b",
          secondary: "#52514e",
          muted: "#898781",
        },
        line: {
          grid: "#e1e0d9",
          axis: "#c3c2b7",
        },
        series: {
          1: "#2a78d6",
          2: "#eb6834",
          3: "#1baf7a",
          4: "#eda100",
          5: "#e87ba4",
          6: "#008300",
          7: "#4a3aa7",
          8: "#e34948",
        },
        status: {
          good: "#0ca30c",
          goodBg: "#e6f6e6",
          warning: "#fab219",
          warningBg: "#fef3dc",
          serious: "#ec835a",
          seriousBg: "#fce6dd",
          critical: "#d03b3b",
          criticalBg: "#fbe2e2",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
