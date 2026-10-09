import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import ChartCard from "./ChartCard";
import type { ActivityRoleStat } from "../types/statistics.types";

interface ActivityRoleChartProps {
  data: ActivityRoleStat[];
  onSelect?: (role: string) => void;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold text-primary">{label}</p>
      <p className="text-xs text-muted">
        {payload[0].value} actividad{payload[0].value !== 1 ? "es" : ""}
      </p>
    </div>
  );
};

function ActivityRoleChart({ data, onSelect }: ActivityRoleChartProps) {
  return (
    <ChartCard
      title="Actividades por rol"
      subtitle="Clic en un rol para ver los procesos con esas actividades"
    >
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="role"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-22}
              textAnchor="end"
              height={72}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar
              dataKey="count"
              fill="#004040"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
              cursor={onSelect ? "pointer" : "default"}
              onClick={(entry: { payload?: ActivityRoleStat; role?: string }) => {
                const role = entry.payload?.role ?? entry.role;
                if (role && onSelect) onSelect(role);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          No hay actividades registradas
        </div>
      )}
    </ChartCard>
  );
}

export default ActivityRoleChart;
