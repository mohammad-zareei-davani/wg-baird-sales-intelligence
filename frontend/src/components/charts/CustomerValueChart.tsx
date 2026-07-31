import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TopCustomer } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { tooltipStyle, useChartTheme } from "../../theme/colors";

export function CustomerValueChart({ data }: { data: TopCustomer[] }) {
  const theme = useChartTheme();
  const chartData = [...data].reverse().map((c) => ({
    name: c.customer_name,
    va: c.total_va_amount,
    workType: c.top_work_type,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={theme.gridline} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={theme.axis}
          tick={{ fill: theme.textMuted, fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          stroke={theme.axis}
          tick={{ fill: theme.textSecondary, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: theme.gridline, fillOpacity: 0.4 }}
          contentStyle={tooltipStyle(theme)}
          formatter={(value: number, _name, item) => [
            formatCurrencyCompact(value),
            `Value added (${item.payload.workType})`,
          ]}
        />
        <Bar dataKey="va" radius={[0, 4, 4, 0]} maxBarSize={18} fill={theme.series[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
