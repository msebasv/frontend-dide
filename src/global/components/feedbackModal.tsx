import { createPortal } from "react-dom";
import {
  IoCheckmarkCircle,
  IoCloseCircle,
} from "react-icons/io5";

import Button from "./button";

export type FeedbackType = "success" | "error";

interface FeedbackModalProps {
  isOpen: boolean;
  type: FeedbackType;
  title: string;
  message: string;
  onClose: () => void;
  confirmLabel?: string;
}

const typeStyles: Record<
  FeedbackType,
  { icon: React.ReactNode; ring: string; iconBg: string }
> = {
  success: {
    icon: <IoCheckmarkCircle className="size-10 text-success" />,
    ring: "ring-success/20",
    iconBg: "bg-success/10",
  },
  error: {
    icon: <IoCloseCircle className="size-10 text-danger" />,
    ring: "ring-danger/20",
    iconBg: "bg-danger/10",
  },
};

function FeedbackModal({
  isOpen,
  type,
  title,
  message,
  onClose,
  confirmLabel = "Aceptar",
}: FeedbackModalProps) {
  if (!isOpen) return null;

  const styles = typeStyles[type];

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/50 p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-xl"
        role="alertdialog"
        aria-labelledby="feedback-title"
        aria-describedby="feedback-message"
      >
        <div
          className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full ring-8 ${styles.ring} ${styles.iconBg}`}
        >
          {styles.icon}
        </div>

        <h2
          id="feedback-title"
          className="text-lg font-bold text-primary"
        >
          {title}
        </h2>
        <p id="feedback-message" className="mt-2 text-sm text-muted">
          {message}
        </p>

        <div className="mt-6 flex justify-center">
          <Button
            onClick={onClose}
            variant={type === "error" ? "secondary" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default FeedbackModal;
