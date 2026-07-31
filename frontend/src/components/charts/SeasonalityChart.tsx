import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ForecastRow, MonthlyRow } from "../../api/types";
import { formatCurrencyCompact } from "../../format";
import { CHART_INK, SERIES_COLORS } from "../../theme/colors";

const shortMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleString("en-GB", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
};

/**
 * Booked sales by month with the forward projection appended. Actual and
 * forecast are separate series so the boundary between what happened and
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

  // Repeat the final actual value as the forecast's first point so the two
  // lines join up instead of appearing as disconnected segments.
  const lastActual = monthly.length ? monthly[monthly.length - 1] : null;
  if (lastActual && actual.length) {
    actual[actual.length - 1].forecast = lastActual.sell_price;
  }

  const projected = forecast.map((f) => ({
    label: shortMonth(f.month_start),
    actual: null as number | null,
    forecast: f.forecast,
  }));

  const data = [...actual, ...projected];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            background: CHART_INK.surfaceRaised,
            border: `1px solid ${CHART_INK.border}`,
            borderRadius: 8,
            color: CHART_INK.textPrimary,
            fontSize: 13,
          }}
          formatter={(value: number, name) => [formatCurrencyCompact(value), name]}
        />
        <Legend
          formatter={(v) => <span style={{ color: CHART_INK.textSecondary, fontSize: 12 }}>{v}</span>}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Booked"
          stroke={SERIES_COLORS[0]}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Projected"
          stroke={SERIES_COLORS[1]}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 3 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
