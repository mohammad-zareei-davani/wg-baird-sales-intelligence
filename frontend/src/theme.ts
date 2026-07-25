/**
 * Palette tokens. Every chart series colour must come from here — never a
 * Recharts default. Restrict any single view to two accents.
 */
export const palette = {
  paper: "#F7F6F3",
  ink: "#16161A",
  mid: "#6B6B70",
  cyan: "#0B7FA8",
  magenta: "#B0245E",
  ochre: "#B8860B",
  rule: "#D8D6D0",
} as const;

/** Ink-to-cyan ramp for categorical series; no rainbow. */
export const seriesRamp = [
  palette.cyan,
  palette.ink,
  "#4A9CBF",
  palette.mid,
  "#7FBDD6",
  "#9A9AA0",
] as const;

export const chartAxis = {
  stroke: palette.mid,
  fontSize: 11,
  fontFamily: "IBM Plex Mono, Consolas, monospace",
} as const;
