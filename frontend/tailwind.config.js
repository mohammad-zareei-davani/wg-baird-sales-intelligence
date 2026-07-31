/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral base. A faintly cool grey reads as software rather than
        // paper, and keeps saturated chart colours looking deliberate.
        page: "#f6f7f9",
        surface: "#ffffff",
        raised: "#ffffff",
        edge: "#e6e8ec",
        edgeStrong: "#d5d8de",

        ink: {
          primary: "#101828",
          secondary: "#475467",
          muted: "#8a91a0",
        },
        line: {
          grid: "#eceef2",
          axis: "#cfd3db",
        },

        // One accent, used for brand, interaction and the primary series.
        accent: "#2a78d6",
        accentStrong: "#1c5cab",
        accentSoft: "#eef4fd",

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

        // Reserved for state. Never reused as a series colour.
        status: {
          good: "#0ca30c",
          goodBg: "#eaf7ea",
          goodText: "#046304",
          warning: "#fab219",
          warningBg: "#fdf4e3",
          warningText: "#8a5a00",
          serious: "#ec835a",
          seriousBg: "#fdeee7",
          seriousText: "#a8492a",
          critical: "#d03b3b",
          criticalBg: "#fdecec",
          criticalText: "#b02626",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04)",
        raised: "0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)",
      },
      letterSpacing: {
        label: "0.06em",
      },
    },
  },
  plugins: [],
};
