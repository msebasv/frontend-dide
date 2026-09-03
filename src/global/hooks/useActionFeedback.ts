import { useCallback, useRef, useState } from "react";

import type { FeedbackType } from "../components/feedbackModal";
import { toFriendlyFlowError } from "../utils/flowResult";

interface FeedbackState {
  isOpen: boolean;
  type: FeedbackType;
  title: string;
  message: string;
}

const closedState: FeedbackState = {
  isOpen: false,
  type: "success",
  title: "",
  message: "",
};

export function useActionFeedback() {
  const [feedback, setFeedback] = useState<FeedbackState>(closedState);
  const onCloseSuccessRef = useRef<(() => void) | null>(null);

  const closeFeedback = useCallback(() => {
    setFeedback((prev) => {
      if (prev.isOpen && prev.type === "success" && onCloseSuccessRef.current) {
        const callback = onCloseSuccessRef.current;
        onCloseSuccessRef.current = null;
        callback();
      }
      return closedState;
    });
  }, []);

  const runAction = useCallback(
    async (
      action: () => Promise<void>,
      options: {
        successTitle: string;
        successMessage: string;
        errorTitle?: string;
        errorMessage?: string;
        onSuccess?: () => void | Promise<void>;
        onSuccessClose?: () => void;
      },
    ) => {
      try {
        await action();
        await options.onSuccess?.();
        onCloseSuccessRef.current = options.onSuccessClose ?? null;
        setFeedback({
          isOpen: true,
          type: "success",
          title: options.successTitle,
          message: options.successMessage,
        });
      } catch (error) {
        console.error(error);
        onCloseSuccessRef.current = null;
        setFeedback({
          isOpen: true,
          type: "error",
          title: options.errorTitle ?? "No se pudo completar la acción",
          message: toFriendlyFlowError(
            error,
            options.errorMessage ??
              "Ocurrió un error inesperado. Intenta nuevamente.",
          ),
        });
      }
    },
    [],
  );

  return { feedback, closeFeedback, runAction };
}
