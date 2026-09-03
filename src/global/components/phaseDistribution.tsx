interface PhaseItem {
  label: string;
  count: number;
  color: string;
}

interface PhaseDistributionProps {
  title: string;
  items: PhaseItem[];
  total: number;
}

function PhaseDistribution({ title, items, total }: PhaseDistributionProps) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="min-w-0 rounded-[1.25rem] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-bold text-primary">
          {title}
        </h3>
        <span className="shrink-0 rounded-full bg-acacia-10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {total} total
        </span>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const barWidth = (item.count / maxCount) * 100;

          return (
            <div key={item.label} className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-muted">
                  {item.label}
                </span>
                <span className="shrink-0 font-medium text-muted">
                  {item.count}{" "}
                  <span className="text-primary">{pct}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-acacia-5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: item.color || "#86C127",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PhaseDistribution;
