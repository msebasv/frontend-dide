import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import ChartCard from "./ChartCard";
import type { MonthlyTrend } from "../types/statistics.types";

interface MonthlyTrendChartProps {
  data: MonthlyTrend[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="mb-1 text-xs font-semibold text-primary">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs text-muted">
          <span style={{ color: entry.color }}>●</span>{" "}
          {entry.dataKey === "activities" ? "Actividades" : "Procesos nuevos"}:{" "}
          {entry.value}
        </p>
      ))}
    </div>
  );
};

function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <ChartCard
      title="Tendencia mensual"
      subtitle="Actividad y creación de procesos en los últimos 6 meses"
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="activitiesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#004040" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#004040" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="processesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#86c127" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#86c127" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-600">
                {value === "activities" ? "Actividades" : "Procesos nuevos"}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="activities"
            stroke="#004040"
            strokeWidth={2}
            fill="url(#activitiesGradient)"
          />
          <Area
            type="monotone"
            dataKey="processes"
            stroke="#86c127"
            strokeWidth={2}
            fill="url(#processesGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default MonthlyTrendChart;
