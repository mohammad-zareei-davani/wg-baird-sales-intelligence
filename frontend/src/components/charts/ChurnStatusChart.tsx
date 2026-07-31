import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChurnStatus } from "../../api/types";
import { CHART_INK, STATUS_COLORS } from "../../theme/colors";

const STATUS_COLOR: Record<ChurnStatus, string> = {
  Active: STATUS_COLORS.good,
  "At Risk": STATUS_COLORS.warning,
  Dormant: STATUS_COLORS.critical,
};

export function ChurnStatusChart({ counts }: { counts: Record<ChurnStatus, number> }) {
  const data = (Object.keys(counts) as ChurnStatus[]).map((status) => ({
    name: status,
    value: counts[status],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLOR[entry.name as ChurnStatus]} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={32}
          formatter={(value) => <span style={{ color: CHART_INK.textSecondary, fontSize: 12 }}>{value}</span>}
        />
        <Tooltip
          contentStyle={{
            background: CHART_INK.surfaceRaised,
            border: `1px solid ${CHART_INK.border}`,
            borderRadius: 8,
            color: CHART_INK.textPrimary,
            fontSize: 13,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
