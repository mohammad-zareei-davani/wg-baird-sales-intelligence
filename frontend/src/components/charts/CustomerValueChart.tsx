import {
  Bar, BarChart, CartesianGrid, Cell, Label, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { TopCustomer } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { CHART, SERIES, hoverCursor, tooltipStyle } from "../../theme/colors";

/**
 * Ranked accounts by value added.
 *
 * The accounts the written finding calls out are drawn in the series colour
 * and the rest in a neutral tone, with the average account marked. That way
 * the claim in the text ("four accounts stand ahead, then the field
 * flattens") is something the reader can verify by looking, rather than
 * having to take on trust.
 */
export function CustomerValueChart({
  data,
  aheadCount,
  meanVa,
}: {
  data: TopCustomer[];
  aheadCount?: number;
  meanVa?: number;
}) {
  // Already ranked highest-first; recharts puts the first category at the top.
  const chartData = data.map((c) => ({
    name: c.customer_name,
    va: c.total_va_amount,
    workType: c.top_work_type,
  }));

  const ahead = aheadCount ?? 0;

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
        {meanVa ? (
          <ReferenceLine x={meanVa} stroke={CHART.textMuted} strokeDasharray="4 4">
            <Label
              value="Average account"
              position="insideTopRight"
              fill={CHART.textMuted}
              fontSize={10.5}
            />
          </ReferenceLine>
        ) : null}
        <Bar dataKey="va" radius={[0, 0, 0, 0]} maxBarSize={16}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={ahead && i < ahead ? SERIES[0] : CHART.neutral} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
