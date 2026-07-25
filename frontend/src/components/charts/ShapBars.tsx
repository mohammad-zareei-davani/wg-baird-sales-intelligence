import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGbp, formatGbpCompact } from "../../format";
import { palette } from "../../theme";
import type { ShapContribution } from "../../types";

export function ShapBars({ contributions }: { contributions: ShapContribution[] }) {
  const data = [...contributions].sort(
    (a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value),
  );

  return (
    <div className="fade-in h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 24, left: 8 }}
        >
          <CartesianGrid stroke={palette.rule} horizontal={false} />
          <XAxis
            type="number"
            stroke={palette.mid}
            tickFormatter={(value: number) => formatGbpCompact(value)}
            tick={{ fill: palette.mid, fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }}
            label={{
              value: "Signed contribution to predicted VA (GBP)",
              position: "insideBottom",
              offset: -14,
              fill: palette.mid,
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke={palette.mid}
            tick={{ fill: palette.ink, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
            width={110}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: palette.paper,
              border: `1px solid ${palette.ink}`,
              borderRadius: 0,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
            }}
            formatter={(value: number) => [formatGbp(value), "SHAP"]}
          />
          <ReferenceLine x={0} stroke={palette.ink} />
          <Bar dataKey="shap_value" name="Contribution" barSize={14}>
            {data.map((entry) => (
              <Cell
                key={entry.feature}
                fill={entry.shap_value >= 0 ? palette.cyan : palette.magenta}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-mid">
        Cyan raises the prediction, magenta lowers it. Source: SHAP TreeExplainer on the
        selected model.
      </p>
    </div>
  );
}
