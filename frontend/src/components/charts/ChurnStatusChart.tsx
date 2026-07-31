import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChurnStatus } from "../../api/types";
import { CHART, STATUS, tooltipStyle } from "../../theme/colors";

const STATUS_COLOR: Record<ChurnStatus, string> = {
  Active: STATUS.good,
  "At Risk": STATUS.warning,
  Dormant: STATUS.critical,
};

export function ChurnStatusChart({ counts }: { counts: Record<ChurnStatus, number> }) {
  const data = (Object.keys(counts) as ChurnStatus[]).map((status) => ({
    name: status,
    value: counts[status],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={54}
          outerRadius={82}
          paddingAngle={2}
          stroke={CHART.surface}
          strokeWidth={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLOR[entry.name as ChurnStatus]} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={30}
          formatter={(value) => (
            <span style={{ color: CHART.textSecondary, fontSize: 12 }}>{value}</span>
          )}
        />
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
