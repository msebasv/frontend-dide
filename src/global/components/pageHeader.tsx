import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import clsx from "clsx";

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  actions?: ReactNode;
  badge?: string;
  /** Título más compacto (p. ej. detalle de proceso). */
  compact?: boolean;
}

function PageHeader({
  title,
  description,
  backTo,
  actions,
  badge,
  compact = false,
}: PageHeaderProps) {
  return (
    <div className={clsx(compact ? "mb-4 sm:mb-5" : "mb-5 sm:mb-8")}>
      <div
        className={clsx(
          "rounded-[1.25rem] border border-border bg-white",
          compact ? "px-4 py-3 sm:px-5 sm:py-3.5" : "px-4 py-4 sm:px-5 sm:py-5",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            {backTo && (
              <Link
                to={backTo}
                className={clsx(
                  "flex shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted transition hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  compact ? "mt-0.5 h-8 w-8" : "mt-0.5 h-9 w-9",
                )}
              >
                <IoArrowBack size={compact ? 16 : 18} />
              </Link>
            )}
            <div className="min-w-0">
              {badge && (
                <span className="mb-1.5 inline-block rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {badge}
                </span>
              )}
              <h1
                className={clsx(
                  "font-bold tracking-tight text-primary",
                  compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl",
                )}
              >
                {title}
              </h1>
              {description && (
                <p
                  className={clsx(
                    "max-w-2xl leading-relaxed",
                    compact
                      ? "mt-1 text-sm font-medium text-primary/80"
                      : "mt-1.5 text-sm text-muted",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&_a]:w-full sm:[&_a]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PageHeader;
