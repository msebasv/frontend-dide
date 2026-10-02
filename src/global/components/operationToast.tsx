import { createPortal } from "react-dom";
import {
  IoCheckmarkCircle,
  IoCloseCircle,
  IoClose,
  IoSync,
} from "react-icons/io5";

import Button from "./button";

export type OperationToastStatus = "loading" | "success" | "error";

interface OperationToastProps {
  isOpen: boolean;
  status: OperationToastStatus;
  title: string;
  message: string;
  onDismiss: () => void;
  /** Acción secundaria (p. ej. Ver proceso). Solo en éxito. */
  viewActionLabel?: string;
  onViewAction?: () => void;
  dismissLabel?: string;
}

const statusStyles: Record<
  OperationToastStatus,
  { icon: React.ReactNode; bar: string; iconColor: string }
> = {
  loading: {
    icon: <IoSync className="size-5 animate-spin" />,
    bar: "bg-amber-500",
    iconColor: "text-amber-600",
  },
  success: {
    icon: <IoCheckmarkCircle className="size-5" />,
    bar: "bg-success",
    iconColor: "text-success",
  },
  error: {
    icon: <IoCloseCircle className="size-5" />,
    bar: "bg-danger",
    iconColor: "text-danger",
  },
};

function OperationToast({
  isOpen,
  status,
  title,
  message,
  onDismiss,
  viewActionLabel,
  onViewAction,
  dismissLabel = "Aceptar",
}: OperationToastProps) {
  if (!isOpen) return null;

  const styles = statusStyles[status];
  const showActions = status !== "loading";
  const showView = status === "success" && Boolean(viewActionLabel);

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex justify-end p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:p-0"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card-hover)]">
        <div className={`h-1 w-full ${styles.bar}`} />
        <div className="flex gap-3 p-4">
          <div className={`mt-0.5 shrink-0 ${styles.iconColor}`}>
            {styles.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-primary">{title}</h3>
              {status === "loading" ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded p-0.5 text-muted hover:bg-gray-100 hover:text-primary"
                  aria-label="Ocultar aviso"
                  title="El procesamiento continúa en segundo plano"
                >
                  <IoClose className="size-4" />
                </button>
              ) : null}
            </div>
            {message.trim() ? (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {message}
              </p>
            ) : null}
            {showActions ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={onDismiss}>
                  {dismissLabel}
                </Button>
                {showView ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onViewAction?.();
                      onDismiss();
                    }}
                  >
                    {viewActionLabel}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default OperationToast;
