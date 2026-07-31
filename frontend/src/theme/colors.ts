/**
 * Chart palette. Recharts takes colours as literal strings rather than CSS
 * classes, so the values the charts use are declared here and mirror the
 * tokens in tailwind.config.js.
 *
 * The eight series hues are ordered so that adjacent pairs stay separable for
 * colour-blind readers. The ordering is the safety mechanism, not decoration,
 * so add to the end rather than reshuffling.
 */
export const SERIES = [
  "#0c6b7a", // process cyan
  "#c45c2a", // burnt orange
  "#1a9a6c", // green
  "#c48a00", // amber
  "#c45a82", // magenta
  "#2d7a3a", // forest
  "#5a4a9e", // violet
  "#c43c3c", // red
] as const;

export const STATUS = {
  good: "#1a8f3c",
  warning: "#c48a00",
  serious: "#c45c2a",
  critical: "#c43c3c",
} as const;

export const CHART = {
  gridline: "#e4e7ec",
  axis: "#c5cad3",
  textMuted: "#6e7785",
  textSecondary: "#3f4754",
  textPrimary: "#0f1419",
  surface: "#ffffff",
  border: "#d4d8de",
} as const;

/** Shared tooltip styling so every chart's hover card matches. */
export const tooltipStyle = {
  background: CHART.surface,
  border: `1px solid ${CHART.border}`,
  borderRadius: 6,
  boxShadow: "0 8px 24px rgba(15, 20, 25, 0.08)",
  color: CHART.textPrimary,
  fontSize: 12.5,
  padding: "8px 10px",
} as const;

/** Faint wash behind the hovered bar/column. */
export const hoverCursor = { fill: CHART.gridline, fillOpacity: 0.7 } as const;
