import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WorkTypeBreakdown } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { tooltipStyle, useChartTheme } from "../../theme/colors";

export function WorkTypeChart({ data }: { data: WorkTypeBreakdown[] }) {
  const theme = useChartTheme();
  const chartData = data.map((w) => ({ name: w.work_type, va: w.total_va_amount, jobs: w.job_count }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={theme.gridline} vertical={false} />
        <XAxis dataKey="name" stroke={theme.axis} tick={{ fill: theme.textSecondary, fontSize: 11 }} />
        <YAxis
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={theme.axis}
          tick={{ fill: theme.textMuted, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: theme.gridline, fillOpacity: 0.4 }}
          contentStyle={tooltipStyle(theme)}
          formatter={(value: number, _name, item) => [
            formatCurrencyCompact(value),
            `Value added (${item.payload.jobs} jobs)`,
          ]}
        />
        <Bar dataKey="va" radius={[4, 4, 0, 0]} maxBarSize={64}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={theme.series[i % theme.series.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
