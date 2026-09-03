import type { ReactNode } from "react";
import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  color?: "primary" | "secondary" | "accent" | "warning" | "success" | "danger";
  subtitle?: string;
  trend?: { value: number; label: string };
  /** Si se define, la tarjeta es clicable (p. ej. ver detalle de procesos). */
  onClick?: () => void;
}

const colorConfig = {
  primary: {
    icon: "bg-primary text-white",
    value: "text-primary",
  },
  secondary: {
    icon: "bg-secondary text-white",
    value: "text-secondary",
  },
  accent: {
    icon: "bg-accent text-white",
    value: "text-accent",
  },
  warning: {
    icon: "bg-warning text-white",
    value: "text-warning",
  },
  success: {
    icon: "bg-success text-white",
    value: "text-success",
  },
  danger: {
    icon: "bg-danger text-white",
    value: "text-danger",
  },
};

function StatCard({
  label,
  value,
  icon,
  color = "primary",
  subtitle,
  trend,
  onClick,
}: StatCardProps) {
  const cfg = colorConfig[color];
  const clickable = Boolean(onClick);

  const className = clsx(
    "w-full rounded-[1.25rem] border border-border bg-surface p-5 text-left shadow-[var(--shadow-card)]",
    "transition-all duration-200",
    clickable
      ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
      : "hover:-translate-y-0.5 hover:border-secondary/30 hover:shadow-[var(--shadow-card-hover)]",
  );

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </p>
        <p
          className={clsx(
            "mt-2 text-3xl font-bold tracking-tight leading-none",
            cfg.value,
          )}
        >
          {value}
        </p>
        {subtitle && <p className="mt-2 text-xs text-muted">{subtitle}</p>}
        {trend && (
          <p className="mt-2 text-xs text-muted">
            <span className="font-semibold text-success">+{trend.value}</span>{" "}
            {trend.label}
          </p>
        )}
        {clickable && (
          <p className="mt-2 text-[11px] font-semibold text-primary/55">
            Ver procesos →
          </p>
        )}
      </div>
      {icon && (
        <div
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            cfg.icon,
          )}
        >
          {icon}
        </div>
      )}
    </div>
  );

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export default StatCard;
