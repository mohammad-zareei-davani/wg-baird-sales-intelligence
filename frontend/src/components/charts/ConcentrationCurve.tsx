import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPct } from "../../format";
import { palette } from "../../theme";
import type { ConcentrationPoint } from "../../types";

interface ConcentrationCurveProps {
  va: ConcentrationPoint[];
  revenue: ConcentrationPoint[];
}

export function ConcentrationCurve({ va, revenue }: ConcentrationCurveProps) {
  const merged = va.map((point, index) => ({
    rank: point.rank,
    va_share: point.cumulative_share,
    revenue_share: revenue[index]?.cumulative_share ?? null,
  }));

  return (
    <div className="fade-in h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid stroke={palette.rule} vertical={false} />
          <XAxis
            dataKey="rank"
            stroke={palette.mid}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            label={{
              value: "Customer rank (1 = largest)",
              position: "insideBottom",
              offset: -14,
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <YAxis
            stroke={palette.mid}
            domain={[0, 1]}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            width={52}
            label={{
              value: "Cumulative share (%)",
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
            formatter={(value: number, name: string) => [formatPct(value), name]}
            labelFormatter={(label: number) => `Top ${label} customers`}
          />
          <ReferenceLine y={0.5} stroke={palette.mid} strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="va_share"
            name="VA share"
            stroke={palette.cyan}
            strokeWidth={1.75}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="revenue_share"
            name="Revenue share"
            stroke={palette.ink}
            strokeWidth={1.25}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 flex gap-4 text-[11px] text-mid">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: palette.cyan }} />
          Cumulative VA share
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: palette.ink }}
          />
          Cumulative revenue share
        </span>
      </p>
    </div>
  );
}
