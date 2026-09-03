import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** Evita cerrar el modal (p. ej. mientras hay una operación en curso). */
  preventClose?: boolean;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-6xl",
};

const Modal = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  size = "md",
  preventClose = false,
}: ModalProps) => {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (preventClose) return;
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-gray-900/50 p-0 pt-[env(safe-area-inset-top)] sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        className={`flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-3xl ${sizeStyles[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-acacia-5 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="rounded-full bg-white px-2.5 py-2.5 text-primary shadow-sm ring-1 ring-border">
                {icon}
              </div>
            )}
            <h2 className="truncate text-base font-bold text-primary sm:text-lg">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={preventClose}
            className="flex h-10 w-10 items-center justify-center rounded-full p-1 text-muted transition hover:bg-white hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Cerrar"
          >
            <IoClose size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
