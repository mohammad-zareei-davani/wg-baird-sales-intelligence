import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TopCustomer } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { CHART_INK, SERIES_COLORS } from "../../theme/colors";

export function CustomerValueChart({ data }: { data: TopCustomer[] }) {
  const chartData = [...data].reverse().map((c) => ({
    name: c.customer_name,
    va: c.total_va_amount,
    workType: c.top_work_type,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_INK.gridline} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textSecondary, fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: CHART_INK.surfaceRaised,
            border: `1px solid ${CHART_INK.border}`,
            borderRadius: 8,
            color: CHART_INK.textPrimary,
            fontSize: 13,
          }}
          formatter={(value: number, _name, item) => [
            formatCurrencyCompact(value),
            `VA Amount (${item.payload.workType})`,
          ]}
        />
        <Bar dataKey="va" radius={[0, 4, 4, 0]} maxBarSize={18} fill={SERIES_COLORS[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
