import type { ReactNode } from "react";
import clsx from "clsx";

import Card from "../../global/components/card";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <Card className={clsx("flex h-full flex-col overflow-hidden", className)} padding="none">
      <div className="border-b border-border bg-acacia-5 px-5 py-4">
        <h3 className="text-sm font-bold text-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      <div className="min-h-[220px] flex-1 p-5 sm:min-h-[280px]">{children}</div>
    </Card>
  );
}

export default ChartCard;
