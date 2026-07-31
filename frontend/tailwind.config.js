/** @type {import('tailwindcss').Config} */

// Colours resolve through CSS custom properties so a single `dark` class on
// <html> reskins the whole app — every existing utility class keeps working
// in both modes without needing a `dark:` variant on each element.
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: withAlpha("--c-page"),
        surface: withAlpha("--c-surface"),
        raised: withAlpha("--c-raised"),
        accentSoft: withAlpha("--c-accent-soft"),
        ink: {
          primary: withAlpha("--c-ink-primary"),
          secondary: withAlpha("--c-ink-secondary"),
          muted: withAlpha("--c-ink-muted"),
        },
        line: {
          grid: withAlpha("--c-line-grid"),
          axis: withAlpha("--c-line-axis"),
        },
        edge: withAlpha("--c-edge"),
        series: {
          1: withAlpha("--c-series-1"),
          2: withAlpha("--c-series-2"),
          3: withAlpha("--c-series-3"),
          4: withAlpha("--c-series-4"),
          5: withAlpha("--c-series-5"),
          6: withAlpha("--c-series-6"),
          7: withAlpha("--c-series-7"),
          8: withAlpha("--c-series-8"),
        },
        status: {
          good: withAlpha("--c-status-good"),
          goodBg: withAlpha("--c-status-good-bg"),
          goodText: withAlpha("--c-status-good-text"),
          warning: withAlpha("--c-status-warning"),
          warningBg: withAlpha("--c-status-warning-bg"),
          warningText: withAlpha("--c-status-warning-text"),
          serious: withAlpha("--c-status-serious"),
          seriousBg: withAlpha("--c-status-serious-bg"),
          seriousText: withAlpha("--c-status-serious-text"),
          critical: withAlpha("--c-status-critical"),
          criticalBg: withAlpha("--c-status-critical-bg"),
          criticalText: withAlpha("--c-status-critical-text"),
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
