import { useState, type ReactNode } from "react";
import { IoAdd } from "react-icons/io5";
import clsx from "clsx";

interface AccordionItemProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** Desplegable estilo recursos (Ver más / ver detalle) */
function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-acacia-5"
      >
        <span className="text-sm font-semibold text-primary">{title}</span>
        <span
          className={clsx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-primary transition",
            open && "rotate-45 border-primary bg-primary text-white",
          )}
        >
          <IoAdd size={16} />
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 text-sm text-muted">
          {children}
        </div>
      )}
    </div>
  );
}

interface AccordionProps {
  children: ReactNode;
  className?: string;
}

function Accordion({ children, className }: AccordionProps) {
  return <div className={clsx("space-y-2", className)}>{children}</div>;
}

export { Accordion, AccordionItem };
