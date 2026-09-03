import clsx from "clsx";

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
  /** Color del fill; por defecto Color Base Acacia */
  color?: string;
}

/** Barra de progreso estilo recursos (bar_progress) */
function ProgressBar({
  value,
  label = "Progreso",
  showPercent = true,
  className,
  color = "#86C127",
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      className={clsx(
        "flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {label && (
        <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      )}
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-acacia-5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showPercent && (
        <span className="shrink-0 text-xs font-medium text-muted">{pct}%</span>
      )}
    </div>
  );
}

export default ProgressBar;
