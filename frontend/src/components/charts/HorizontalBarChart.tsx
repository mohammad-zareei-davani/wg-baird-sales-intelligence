import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_INK, SERIES_COLORS } from "../../theme/colors";

export interface HBarDatum {
  name: string;
  value: number;
}

/**
 * Ranked comparison of a single measure across named categories — the right
 * form whenever the question is "who/what is biggest", and long labels make
 * a vertical axis unreadable.
 */
export function HorizontalBarChart({
  data,
  colorIndex = 0,
  valueFormatter,
  valueLabel,
  height,
}: {
  data: HBarDatum[];
  colorIndex?: number;
  valueFormatter: (v: number) => string;
  valueLabel: string;
  height?: number;
}) {
  const chartData = [...data].reverse();
  const computedHeight = height ?? Math.max(220, chartData.length * 30);

  return (
    <ResponsiveContainer width="100%" height={computedHeight}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_INK.gridline} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={valueFormatter}
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textSecondary, fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            background: CHART_INK.surfaceRaised,
            border: `1px solid ${CHART_INK.border}`,
            borderRadius: 8,
            color: CHART_INK.textPrimary,
            fontSize: 13,
          }}
          formatter={(value: number) => [valueFormatter(value), valueLabel]}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          fill={SERIES_COLORS[colorIndex % SERIES_COLORS.length]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
