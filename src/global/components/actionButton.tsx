import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import clsx from "clsx";

type ActionVariant = "view" | "upload" | "validate" | "edit";

/** view = quiet; upload/validate = solid CTAs; edit = medium emphasis */
const variantStyles: Record<ActionVariant, string> = {
  view: "bg-transparent text-muted border-border hover:bg-primary/5 hover:text-primary hover:border-primary/20",
  upload:
    "bg-secondary text-white border-secondary shadow-sm hover:bg-secondary-light hover:shadow-md",
  validate:
    "bg-accent text-white border-accent shadow-sm hover:bg-accent/90 hover:shadow-md",
  edit: "bg-warning/10 text-warning border-warning/25 hover:bg-warning/20",
};

interface ActionButtonProps {
  to: string;
  icon: ReactNode;
  label: string;
  variant?: ActionVariant;
}

function ActionButton({
  to,
  icon,
  label,
  variant = "view",
}: ActionButtonProps) {
  return (
    <Link
      to={to}
      onClick={(event) => event.stopPropagation()}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
        "text-xs font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-offset-1",
        "active:scale-[0.98]",
        variantStyles[variant],
      )}
    >
      <span className="shrink-0 [&_svg]:size-[13px]">{icon}</span>
      {label}
    </Link>
  );
}

export default ActionButton;
