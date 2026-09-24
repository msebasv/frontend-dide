import { useState } from "react";
import {
  IoAdd,
  IoInformationCircleOutline,
} from "react-icons/io5";
import clsx from "clsx";

interface InfoItem {
  label: string;
  value: string;
}

interface InfoCardProps {
  title: string;
  items: InfoItem[];
  /** Si es true, el contenido solo se muestra al expandir. */
  collapsible?: boolean;
  /** Estado inicial cuando `collapsible` está activo. */
  defaultOpen?: boolean;
  /** Compacta el alto del contenido (menos padding y celdas más bajas). */
  compact?: boolean;
}

function InfoCard({
  title,
  items,
  collapsible = false,
  defaultOpen = false,
  compact = false,
}: InfoCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const showBody = !collapsible || open;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 border-b border-border bg-acacia-5 px-4 py-2.5 text-left transition hover:bg-acacia-5/80 sm:px-5"
          aria-expanded={open}
        >
          <div className="flex min-w-0 items-center gap-2">
            <IoInformationCircleOutline
              className="shrink-0 text-secondary"
              size={16}
            />
            <h3 className="truncate text-sm font-semibold text-primary">
              {title}
            </h3>
          </div>
          <span
            className={clsx(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition",
              open
                ? "rotate-45 bg-success text-white shadow-sm"
                : "border border-success/50 bg-success/10 text-success hover:bg-success/20",
            )}
          >
            <IoAdd size={14} />
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 border-b border-border bg-acacia-5 px-4 py-2.5 sm:px-5">
          <IoInformationCircleOutline
            className="shrink-0 text-secondary"
            size={16}
          />
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
        </div>
      )}

      {showBody ? (
        <dl
          className={clsx(
            "grid sm:grid-cols-2 lg:grid-cols-3",
            compact ? "gap-2 p-2.5 sm:p-3" : "gap-3 p-3 sm:gap-4 sm:p-5",
          )}
        >
          {items.map((item) => (
            <div
              key={item.label}
              className={clsx(
                "min-w-0 rounded-xl bg-acacia-5/80",
                compact ? "px-2.5 py-1.5" : "rounded-2xl px-3 py-3 sm:px-4",
              )}
            >
              <dt
                className={clsx(
                  "font-semibold uppercase tracking-wider text-muted",
                  compact ? "text-[10px]" : "text-[11px]",
                )}
              >
                {item.label}
              </dt>
              <dd
                className={clsx(
                  "font-semibold text-primary [overflow-wrap:anywhere]",
                  compact ? "mt-0.5 text-xs" : "mt-1 text-sm",
                )}
              >
                {item.value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export default InfoCard;
