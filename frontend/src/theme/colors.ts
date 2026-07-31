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
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export const CHART = {
  gridline: "#eceef2",
  axis: "#cfd3db",
  textMuted: "#8a91a0",
  textSecondary: "#475467",
  textPrimary: "#101828",
  surface: "#ffffff",
  border: "#e6e8ec",
} as const;

/** Shared tooltip styling so every chart's hover card matches. */
export const tooltipStyle = {
  background: CHART.surface,
  border: `1px solid ${CHART.border}`,
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.08)",
  color: CHART.textPrimary,
  fontSize: 12.5,
  padding: "8px 10px",
} as const;

/** Faint wash behind the hovered bar/column. */
export const hoverCursor = { fill: CHART.gridline, fillOpacity: 0.7 } as const;
