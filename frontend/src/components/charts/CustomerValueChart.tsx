import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TopCustomer } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { CHART, SERIES, hoverCursor, tooltipStyle } from "../../theme/colors";

export function CustomerValueChart({ data }: { data: TopCustomer[] }) {
  // Already ranked highest-first; recharts puts the first category at the top.
  const chartData = data.map((c) => ({
    name: c.customer_name,
    va: c.total_va_amount,
    workType: c.top_work_type,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 26)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART.gridline} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textMuted, fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={88}
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textSecondary, fontSize: 11 }}
        />
        <Tooltip
          cursor={hoverCursor}
          contentStyle={tooltipStyle}
          formatter={(value: number, _name, item) => [
            formatCurrencyCompact(value),
            `Value added (${item.payload.workType})`,
          ]}
        />
        <Bar dataKey="va" radius={[0, 0, 0, 0]} maxBarSize={16} fill={SERIES[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
