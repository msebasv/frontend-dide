import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "./ChartCard";

export interface ElapsedDaysBar {
  key: string;
  label: string;
  count: number;
  color?: string;
}

interface ElapsedDaysChartProps {
  data: ElapsedDaysBar[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  unitLabel?: string;
  onSelect?: (key: string) => void;
}

const CustomTooltip = ({
  active,
  payload,
  unitLabel = "proceso",
}: {
  active?: boolean;
  payload?: { payload: ElapsedDaysBar }[];
  unitLabel?: string;
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold text-primary">{item.label}</p>
      <p className="text-xs text-muted">
        {item.count} {unitLabel}
        {item.count === 1 ? "" : "s"}
      </p>
    </div>
  );
};

function ElapsedDaysChart({
  data,
  title = "Días transcurridos",
  subtitle = "Clic en una barra para ver el detalle",
  emptyMessage = "No hay datos para calcular días transcurridos",
  unitLabel = "proceso",
  onSelect,
}: ElapsedDaysChartProps) {
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={64}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip unitLabel={unitLabel} />} />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              cursor={onSelect ? "pointer" : "default"}
              onClick={(entry) => {
                const row = entry as unknown as ElapsedDaysBar & {
                  payload?: ElapsedDaysBar;
                };
                const key = row.payload?.key ?? row.key;
                if (key && onSelect) onSelect(key);
              }}
            >
              {data.map((item) => (
                <Cell key={item.key} fill={item.color ?? "#004040"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          {emptyMessage}
        </div>
      )}
    </ChartCard>
  );
}

export default ElapsedDaysChart;
