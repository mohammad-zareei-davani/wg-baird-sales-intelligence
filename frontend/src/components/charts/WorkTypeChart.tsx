import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WorkTypeBreakdown } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { CHART_INK, SERIES_COLORS } from "../../theme/colors";

export function WorkTypeChart({ data }: { data: WorkTypeBreakdown[] }) {
  const chartData = data.map((w) => ({ name: w.work_type, va: w.total_va_amount, jobs: w.job_count }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
        <XAxis dataKey="name" stroke={CHART_INK.axis} tick={{ fill: CHART_INK.textSecondary, fontSize: 12 }} />
        <YAxis
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: CHART_INK.surfaceRaised,
            border: `1px solid ${CHART_INK.border}`,
            borderRadius: 8,
            color: CHART_INK.textPrimary,
            fontSize: 13,
          }}
          formatter={(value: number, _name, item) => [formatCurrencyCompact(value), `VA (${item.payload.jobs} jobs)`]}
        />
        <Bar dataKey="va" radius={[4, 4, 0, 0]} maxBarSize={64}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
