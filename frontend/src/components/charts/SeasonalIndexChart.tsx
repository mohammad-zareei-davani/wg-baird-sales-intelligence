import {
  Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SeasonalIndexRow } from "../../api/types";
import { CHART_INK, SERIES_COLORS } from "../../theme/colors";

/**
 * Each calendar month's typical level against an average month (=100), so
 * the shape of the year is readable at a glance.
 */
export function SeasonalIndexChart({ data }: { data: SeasonalIndexRow[] }) {
  const chartData = data.map((d) => ({ name: d.month_name, index: d.seasonal_index }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
        <XAxis dataKey="name" stroke={CHART_INK.axis} tick={{ fill: CHART_INK.textSecondary, fontSize: 11 }} />
        <YAxis
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 11 }}
          tickFormatter={(v: number) => `${v}`}
        />
        <ReferenceLine y={100} stroke={CHART_INK.axis} strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{
            background: CHART_INK.surfaceRaised,
            border: `1px solid ${CHART_INK.border}`,
            borderRadius: 8,
            color: CHART_INK.textPrimary,
            fontSize: 13,
          }}
          formatter={(value: number) => [`${value.toFixed(0)}% of an average month`, "Level"]}
        />
        <Bar dataKey="index" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {chartData.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.index >= 100 ? SERIES_COLORS[0] : SERIES_COLORS[3]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
