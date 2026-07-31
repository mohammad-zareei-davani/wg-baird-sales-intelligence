import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ForecastRow, MonthlyRow } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { CHART, SERIES, tooltipStyle } from "../../theme/colors";

const shortMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleString("en-GB", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
};

/**
 * Booked sales by month with the forward projection appended. Actual and
 * projected are separate series so the boundary between what happened and
 * what is predicted is never ambiguous.
 */
export function SeasonalityChart({
  monthly,
  forecast,
}: {
  monthly: MonthlyRow[];
  forecast: ForecastRow[];
}) {
  const actual = monthly.map((m) => ({
    label: shortMonth(m.month_start),
    actual: m.sell_price,
    forecast: null as number | null,
  }));

  // Repeat the final actual value as the projection's first point so the two
  // lines join rather than appearing as disconnected segments.
  const lastActual = monthly.length ? monthly[monthly.length - 1] : null;
  if (lastActual && actual.length) {
    actual[actual.length - 1].forecast = lastActual.sell_price;
  }

  const projected = forecast.map((f) => ({
    label: shortMonth(f.month_start),
    actual: null as number | null,
    forecast: f.forecast,
  }));

  return (
    <ResponsiveContainer width="100%" height={290}>
      <LineChart data={[...actual, ...projected]} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART.gridline} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textMuted, fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={26}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={CHART.axis}
          tickLine={false}
          tick={{ fill: CHART.textMuted, fontSize: 11 }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name) => [formatCurrencyCompact(value), name]}
        />
        <Legend
          formatter={(v) => <span style={{ color: CHART.textSecondary, fontSize: 12 }}>{v}</span>}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Booked"
          stroke={SERIES[0]}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Projected"
          stroke={SERIES[1]}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 2.5 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
