import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGbp, formatGbpCompact, formatYearMonthTick } from "../../format";
import { palette } from "../../theme";
import type { MonthlyPoint } from "../../types";

export function MonthlyVaChart({ monthly }: { monthly: MonthlyPoint[] }) {
  return (
    <div className="fade-in h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={monthly} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid stroke={palette.rule} vertical={false} />
          <XAxis
            dataKey="year_month"
            tickFormatter={formatYearMonthTick}
            stroke={palette.mid}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            interval={2}
            label={{
              value: "Booking month (SalesIn)",
              position: "insideBottom",
              offset: -14,
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <YAxis
            stroke={palette.mid}
            tickFormatter={(value: number) => formatGbpCompact(value)}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            width={64}
            label={{
              value: "VA (GBP)",
              angle: -90,
              position: "insideLeft",
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: palette.paper,
              border: `1px solid ${palette.ink}`,
              borderRadius: 0,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
            }}
            formatter={(value: number) => [formatGbp(value), "VA"]}
            labelFormatter={(label: string) => formatYearMonthTick(label)}
          />
          <Line
            type="monotone"
            dataKey="va_gbp"
            name="Value added (GBP)"
            stroke={palette.cyan}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3, fill: palette.cyan, stroke: palette.paper }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
