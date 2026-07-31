import {
  Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SeasonalIndexRow } from "../../api/types";
import { tooltipStyle, useChartTheme } from "../../theme/colors";

/**
 * Each calendar month's typical level against an average month (=100), so the
 * shape of the year is readable at a glance.
 */
export function SeasonalIndexChart({ data }: { data: SeasonalIndexRow[] }) {
  const theme = useChartTheme();
  const chartData = data.map((d) => ({ name: d.month_name, index: d.seasonal_index }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={theme.gridline} vertical={false} />
        <XAxis dataKey="name" stroke={theme.axis} tick={{ fill: theme.textSecondary, fontSize: 11 }} />
        <YAxis
          stroke={theme.axis}
          tick={{ fill: theme.textMuted, fontSize: 11 }}
          tickFormatter={(v: number) => `${v}`}
        />
        <ReferenceLine y={100} stroke={theme.axis} strokeDasharray="4 4" />
        <Tooltip
          cursor={{ fill: theme.gridline, fillOpacity: 0.4 }}
          contentStyle={tooltipStyle(theme)}
          formatter={(value: number) => [`${value.toFixed(0)}% of an average month`, "Level"]}
        />
        <Bar dataKey="index" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.index >= 100 ? theme.series[0] : theme.series[3]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
