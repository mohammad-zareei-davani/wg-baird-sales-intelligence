import {
  Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SeasonalIndexRow } from "../../api/types";
import { CHART, SERIES, hoverCursor, tooltipStyle } from "../../theme/colors";

/**
 * Each calendar month's typical level against an average month (=100), so the
 * shape of the year is readable at a glance. Months above and below the line
 * are separated by colour, with the reference line carrying the meaning.
 */
export function SeasonalIndexChart({ data }: { data: SeasonalIndexRow[] }) {
  const chartData = data.map((d) => ({ name: d.month_name, index: d.seasonal_index }));

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART.gridline} vertical={false} />
        <XAxis
          dataKey="name"
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textSecondary, fontSize: 11 }}
        />
        <YAxis
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textMuted, fontSize: 11 }}
        />
        <ReferenceLine y={100} stroke={CHART.axis} strokeDasharray="4 4" />
        <Tooltip
          cursor={hoverCursor}
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value.toFixed(0)}% of an average month`, "Level"]}
        />
        <Bar dataKey="index" radius={[3, 3, 0, 0]} maxBarSize={34}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.index >= 100 ? SERIES[0] : SERIES[3]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
