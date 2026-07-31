/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pressroom neutrals: cool stone page, paper surfaces, ink text.
        page: "#e8eaed",
        surface: "#f7f8f9",
        raised: "#ffffff",
        edge: "#d4d8de",
        edgeStrong: "#b8bec8",

        ink: {
          primary: "#0f1419",
          secondary: "#3f4754",
          muted: "#6e7785",
        },
        line: {
          grid: "#e4e7ec",
          axis: "#c5cad3",
        },

        // Process cyan — print-house accent, not generic SaaS blue.
        accent: "#0c6b7a",
        accentStrong: "#08505c",
        accentSoft: "#e2f0f2",

        rail: {
          DEFAULT: "#12161e",
          soft: "#1a202c",
          edge: "#2a3140",
          muted: "#8b93a3",
          text: "#c5cad3",
        },

        series: {
          1: "#0c6b7a",
          2: "#c45c2a",
          3: "#1a9a6c",
          4: "#c48a00",
          5: "#c45a82",
          6: "#2d7a3a",
          7: "#5a4a9e",
          8: "#c43c3c",
        },

        status: {
          good: "#1a8f3c",
          goodBg: "#e8f5ec",
          goodText: "#0f5c28",
          warning: "#c48a00",
          warningBg: "#faf3e0",
          warningText: "#7a5800",
          serious: "#c45c2a",
          seriousBg: "#f9ebe4",
          seriousText: "#8a3a18",
          critical: "#c43c3c",
          criticalBg: "#f9e8e8",
          criticalText: "#9a2828",
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
        display: ['"Source Serif 4"', "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(15, 20, 25, 0.04)",
        raised: "0 8px 24px rgba(15, 20, 25, 0.06), 0 1px 0 rgba(15, 20, 25, 0.04)",
      },
      letterSpacing: {
        label: "0.08em",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};
