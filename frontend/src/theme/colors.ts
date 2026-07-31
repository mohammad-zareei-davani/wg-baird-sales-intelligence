import { useMemo } from "react";
import { useTheme } from "./ThemeContext";

/**
 * Recharts takes colours as literal strings rather than CSS variables, so the
 * chart palette is mirrored here in JS and selected by the active theme.
 * These values are the same steps declared in index.css.
 */
const LIGHT = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  gridline: "#e1e0d9",
  axis: "#c3c2b7",
  textMuted: "#898781",
  textSecondary: "#52514e",
  textPrimary: "#0b0b0b",
  surfaceRaised: "#ffffff",
  border: "rgba(11, 11, 11, 0.12)",
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
} as const;

const DARK = {
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  gridline: "#2c2c2a",
  axis: "#383835",
  textMuted: "#898781",
  textSecondary: "#c3c2b7",
  textPrimary: "#ffffff",
  surfaceRaised: "#232322",
  border: "rgba(255, 255, 255, 0.14)",
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
} as const;

export type ChartTheme = typeof LIGHT;

export function useChartTheme(): ChartTheme {
  const { mode } = useTheme();
  return useMemo(() => (mode === "dark" ? (DARK as unknown as ChartTheme) : LIGHT), [mode]);
}

/** Shared tooltip styling so every chart's hover card matches the surface. */
export function tooltipStyle(theme: ChartTheme) {
  return {
    background: theme.surfaceRaised,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.textPrimary,
    fontSize: 13,
  };
}
