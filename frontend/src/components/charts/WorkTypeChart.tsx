import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WorkTypeBreakdown } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { CHART, SERIES, hoverCursor, tooltipStyle } from "../../theme/colors";

export function WorkTypeChart({ data }: { data: WorkTypeBreakdown[] }) {
  const chartData = data.map((w) => ({ name: w.work_type, va: w.total_va_amount, jobs: w.job_count }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART.gridline} vertical={false} />
        <XAxis
          dataKey="name"
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textSecondary, fontSize: 11 }}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textMuted, fontSize: 11 }}
        />
        <Tooltip
          cursor={hoverCursor}
          contentStyle={tooltipStyle}
          formatter={(value: number, _name, item) => [
            formatCurrencyCompact(value),
            `Value added (${item.payload.jobs} jobs)`,
          ]}
        />
        <Bar dataKey="va" radius={[3, 3, 0, 0]} maxBarSize={56}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
