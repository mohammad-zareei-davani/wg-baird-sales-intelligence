import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tooltipStyle, useChartTheme } from "../../theme/colors";

export interface HBarDatum {
  name: string;
  value: number;
}

/**
 * Ranked comparison of one measure across named categories — the right form
 * when the question is "which is biggest" and the labels are too long to sit
 * under a vertical axis.
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
  const theme = useChartTheme();
  const chartData = [...data].reverse();
  const computedHeight = height ?? Math.max(220, chartData.length * 30);

  return (
    <ResponsiveContainer width="100%" height={computedHeight}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={theme.gridline} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={valueFormatter}
          stroke={theme.axis}
          tick={{ fill: theme.textMuted, fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          stroke={theme.axis}
          tick={{ fill: theme.textSecondary, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: theme.gridline, fillOpacity: 0.4 }}
          contentStyle={tooltipStyle(theme)}
          formatter={(value: number) => [valueFormatter(value), valueLabel]}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          fill={theme.series[colorIndex % theme.series.length]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
