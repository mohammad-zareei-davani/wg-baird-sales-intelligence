import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_INK, SERIES_COLORS } from "../../theme/colors";

const shortMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleString("en-GB", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
};

/** Median days from booking to despatch, month by month. */
export function LeadTimeTrendChart({
  data,
}: {
  data: { month_start: string; median_days: number; job_count: number }[];
}) {
  const chartData = data.map((d) => ({
    label: shortMonth(d.month_start),
    days: d.median_days,
    jobs: d.job_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          stroke={CHART_INK.axis}
          tick={{ fill: CHART_INK.textMuted, fontSize: 11 }}
          tickFormatter={(v: number) => `${v}d`}
        />
        <Tooltip
          contentStyle={{
            background: CHART_INK.surfaceRaised,
            border: `1px solid ${CHART_INK.border}`,
            borderRadius: 8,
            color: CHART_INK.textPrimary,
            fontSize: 13,
          }}
          formatter={(value: number, _n, item) => [
            `${value} days (${item.payload.jobs} jobs)`,
            "Median turnaround",
          ]}
        />
        <Line type="monotone" dataKey="days" stroke={SERIES_COLORS[2]} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
