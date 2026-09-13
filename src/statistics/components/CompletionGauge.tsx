import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

import Card from "../../global/components/card";

interface CompletionGaugeProps {
  rate: number;
  completed: number;
  total: number;
  title?: string;
  subtitle?: string;
}

function CompletionGauge({
  rate,
  completed,
  total,
  title = "Tasa de finalización",
  subtitle = "Procesos completados sobre el total",
}: CompletionGaugeProps) {
  const chartData = [{ name: "Completados", value: rate, fill: "#86c127" }];

  return (
    <Card className="flex h-full flex-col items-center justify-center" padding="md">
      <div className="mb-2 text-center">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      </div>

      <div className="relative h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={14}
            data={chartData}
            startAngle={210}
            endAngle={-30}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: "#DBEAE4" }}
              dataKey="value"
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className="text-3xl font-bold text-secondary">
            {rate}%
          </span>
          <span className="text-xs text-muted">
            {completed} de {total}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default CompletionGauge;
