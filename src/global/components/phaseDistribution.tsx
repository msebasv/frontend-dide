interface PhaseItem {
  key?: string;
  label: string;
  count: number;
  color: string;
}

interface PhaseDistributionFooter {
  label: string;
  count: number;
  total: number;
  onClick?: () => void;
}

interface PhaseDistributionProps {
  title: string;
  items: PhaseItem[];
  total: number;
  /** Texto del badge. Por defecto "total". */
  totalUnit?: string;
  onItemClick?: (key: string) => void;
  footer?: PhaseDistributionFooter;
}

function PhaseDistribution({
  title,
  items,
  total,
  totalUnit = "total",
  onItemClick,
  footer,
}: PhaseDistributionProps) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="min-w-0 rounded-[1.25rem] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-bold text-primary">
          {title}
        </h3>
        <span className="shrink-0 rounded-full bg-acacia-10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {total} {totalUnit}
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const barWidth = (item.count / maxCount) * 100;
          const clickable = Boolean(onItemClick);

          const body = (
            <>
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
            </>
          );

          if (!clickable) {
            return (
              <div key={item.key ?? item.label} className="min-w-0">
                {body}
              </div>
            );
          }

          return (
            <button
              key={item.key ?? item.label}
              type="button"
              onClick={() => onItemClick?.(item.key ?? item.label)}
              className="block w-full min-w-0 rounded-lg px-1 py-1 text-left transition hover:bg-acacia-5"
            >
              {body}
            </button>
          );
        })}
      </div>

      {footer && (
        <div className="mt-4 border-t border-border pt-4">
          {footer.onClick ? (
            <button
              type="button"
              onClick={footer.onClick}
              className="block w-full rounded-lg px-1 py-1 text-left transition hover:bg-acacia-5"
            >
              <FooterBody footer={footer} />
            </button>
          ) : (
            <FooterBody footer={footer} />
          )}
        </div>
      )}
    </div>
  );
}

function FooterBody({ footer }: { footer: PhaseDistributionFooter }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-primary">{footer.label}</span>
      <span className="shrink-0 font-medium text-muted">
        {footer.count} de {footer.total} procesos
      </span>
    </div>
  );
}

export default PhaseDistribution;
