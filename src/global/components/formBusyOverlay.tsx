import type { ReactNode } from "react";
import clsx from "clsx";

interface FormBusyOverlayProps {
  busy: boolean;
  message?: string;
  children: ReactNode;
  className?: string;
}

/** Overlay de carga sobre un formulario: bloquea interacción y muestra spinner. */
function FormBusyOverlay({
  busy,
  message = "Guardando...",
  children,
  className = "",
}: FormBusyOverlayProps) {
  return (
    <div
      className={clsx("relative", className)}
      aria-busy={busy || undefined}
    >
      <div
        className={clsx(
          "transition-[opacity,filter] duration-200",
          busy && "pointer-events-none select-none opacity-50",
        )}
      >
        {children}
      </div>

      {busy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/55 px-4 backdrop-blur-[2px]">
          <div
            role="status"
            className="flex min-w-[220px] flex-col items-center gap-3 rounded-xl border border-border bg-surface px-8 py-6 shadow-[var(--shadow-card)]"
          >
            <div className="relative h-11 w-11">
              <div className="h-11 w-11 rounded-full border-4 border-gray-100" />
              <div className="absolute inset-0 h-11 w-11 animate-spin rounded-full border-4 border-transparent border-t-secondary border-r-secondary/40" />
            </div>
            <p className="text-sm font-medium text-primary">{message}</p>
            <p className="text-xs text-muted">Esto puede tardar unos segundos</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormBusyOverlay;
