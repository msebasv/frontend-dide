/**
 * Feedback global de acciones (éxito / error / “sigue procesando”).
 *
 * Soft-timeout:
 * 1. Modal informativo a los ~5s.
 * 2. Al cerrarlo → toast “cargando” (sobrevive a la navegación).
 * 3. Al confirmar → el toast pasa a éxito/error (sin segundo modal).
 *
 * Mientras haya confirmación en curso (`isOperationPending`):
 * - no se acepta otra `runAction` (evita pisar el poll / toast);
 * - los formularios pueden bloquear edición con ese flag.
 *
 * Varios flujos en secuencia dentro de un mismo `runAction` (p. ej. carpeta
 * temporal + actividad) cuentan como una sola operación.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import FeedbackModal, {
  type FeedbackType,
} from "../components/feedbackModal";
import OperationToast, {
  type OperationToastStatus,
} from "../components/operationToast";
import { OPERATION_COPY } from "../constants/operationCopy";
import {
  continueConfirmInBackground,
  isFlowConfirmationTimeoutError,
  isFlowRunFailedError,
  toFriendlyFlowError,
  type FlowConfirmOutcome,
} from "../utils/flowResult";
import { notifyOperationSettled } from "../utils/operationSettled";
import {
  clearPendingOperation,
  PENDING_OPERATION_TTL_MS,
  readPendingOperation,
} from "../utils/pendingOperation";
import { confirmPendingOperation } from "../utils/resumePendingOperation";

interface FeedbackState {
  isOpen: boolean;
  type: FeedbackType;
  title: string;
  message: string;
  confirmLabel?: string;
}

interface ToastState {
  isOpen: boolean;
  status: OperationToastStatus;
  title: string;
  message: string;
  viewActionLabel?: string;
}

const closedFeedback: FeedbackState = {
  isOpen: false,
  type: "success",
  title: "",
  message: "",
};

const closedToast: ToastState = {
  isOpen: false,
  status: "loading",
  title: "",
  message: "",
};

export type RunActionOptions = {
  successTitle: string;
  successMessage: string;
  errorTitle?: string;
  errorMessage?: string;
  pendingTitle?: string;
  pendingMessage?: string;
  /** Textos del toast mientras sigue el poll en background. */
  toastPendingTitle?: string;
  toastPendingMessage?: string;
  continueConfirm?: () => Promise<boolean>;
  backgroundTimeoutMs?: number;
  backgroundIntervalMs?: number;
  /** Tras éxito inmediato (sin soft-timeout), al cerrar el modal. */
  onSuccessClose?: () => void;
  onSuccess?: () => void | Promise<void>;
  onReleaseLock?: () => void;
  onSoftTimeout?: () => void;
  /**
   * Al cerrar el modal informativo (“Continuar”): p. ej. ir al detalle del curso
   * mientras el toast sigue en background.
   */
  onPendingDismiss?: () => void;
  /** Texto del botón del modal informativo. Por defecto “Continuar”. */
  pendingConfirmLabel?: string;
  onBackgroundFailedMessage?: string;
  /** Mensaje si se intenta otra acción mientras hay confirmación en curso. */
  busyConflictMessage?: string;
  /**
   * Mientras la operación está en soft-timeout, bloquea acciones sobre este
   * recurso (p. ej. botón Cargar de ese entregable).
   */
  pendingResourceLock?: {
    processId: string;
    deliverableId: string;
  };
  /** Botón secundario del toast de éxito (p. ej. Ver proceso). */
  viewActionLabel?: string;
  onViewAction?: () => void;
};

interface ActionFeedbackContextValue {
  feedback: FeedbackState;
  /**
   * true mientras hay soft-timeout pendiente (modal informativo o toast cargando).
   * Usar para mantener el formulario bloqueado si el usuario se queda en la pantalla.
   */
  isOperationPending: boolean;
  /** Entregable bloqueado mientras hay carga/confirmación en curso. */
  pendingResourceLock: { processId: string; deliverableId: string } | null;
  closeFeedback: () => void;
  runAction: (
    action: () => Promise<void>,
    options: RunActionOptions,
  ) => Promise<void>;
  showFeedback: (
    next: FeedbackState & { onSuccessClose?: () => void },
  ) => void;
  dismissToast: () => void;
  /** El aviso de carga se cerró y la solicitud sigue en curso. */
  showRunningIndicator: boolean;
  restoreRunningToast: () => void;
}

const ActionFeedbackContext = createContext<ActionFeedbackContextValue | null>(
  null,
);

interface ActionFeedbackProviderProps {
  children: ReactNode;
}

type PendingSoft = {
  gen: number;
  options: RunActionOptions;
  release: () => void;
};

export function ActionFeedbackProvider({
  children,
}: ActionFeedbackProviderProps) {
  const [feedback, setFeedback] = useState<FeedbackState>(closedFeedback);
  const [toast, setToast] = useState<ToastState>(closedToast);
  const [runningMinimized, setRunningMinimized] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingResourceLock, setPendingResourceLock] = useState<{
    processId: string;
    deliverableId: string;
  } | null>(null);
  const onCloseSuccessRef = useRef<(() => void) | null>(null);
  const onViewActionRef = useRef<(() => void) | null>(null);
  const backgroundGenRef = useRef(0);
  const pendingSoftRef = useRef<PendingSoft | null>(null);
  const isConfirmingRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const setConfirming = useCallback((value: boolean) => {
    isConfirmingRef.current = value;
    setIsConfirming(value);
    if (!value) {
      setPendingResourceLock(null);
    }
  }, []);

  const dismissToast = useCallback(() => {
    const current = toastRef.current;
    if (current.isOpen && current.status === "loading") {
      setRunningMinimized(true);
      setToast({ ...current, isOpen: false });
      return;
    }
    setRunningMinimized(false);
    setToast(closedToast);
    onViewActionRef.current = null;
  }, []);

  const restoreRunningToast = useCallback(() => {
    setRunningMinimized(false);
    setToast((current) =>
      current.status === "loading" ? { ...current, isOpen: true } : current,
    );
  }, []);

  const showLoadingToast = useCallback((options: RunActionOptions) => {
    setRunningMinimized(false);
    setToast({
      isOpen: true,
      status: "loading",
      title:
        options.toastPendingTitle ??
        options.pendingTitle ??
        OPERATION_COPY.toastPendingDefaultTitle,
      message:
        options.toastPendingMessage ??
        OPERATION_COPY.toastPendingDefaultMessage,
    });
  }, []);

  const showSettledToast = useCallback(
    (
      outcome: FlowConfirmOutcome,
      options: RunActionOptions,
      error?: unknown,
    ) => {
      setRunningMinimized(false);
      if (outcome === "confirmed") {
        onViewActionRef.current = options.onViewAction ?? null;
        setToast({
          isOpen: true,
          status: "success",
          title: options.successTitle,
          message: options.successMessage,
          viewActionLabel: options.viewActionLabel,
        });
        return;
      }

      onViewActionRef.current = null;
      notifyOperationSettled();
      const fallback =
        options.onBackgroundFailedMessage ??
        OPERATION_COPY.backgroundFailedDefault;
      setToast({
        isOpen: true,
        status: "error",
        title: options.errorTitle ?? "No se pudo completar la operación",
        message: error ? toFriendlyFlowError(error, fallback) : fallback,
      });
    },
    [],
  );

  const closeFeedback = useCallback(() => {
    setFeedback((prev) => {
      if (!prev.isOpen) return closedFeedback;

      // Soft-timeout: Continuar → toast cargando (el poll sigue).
      if (prev.type === "info" && pendingSoftRef.current) {
        const pendingOptions = pendingSoftRef.current.options;
        showLoadingToast(pendingOptions);
        // Navegar / limpiar UI tras cerrar (fuera del setState).
        window.setTimeout(() => {
          pendingOptions.onPendingDismiss?.();
        }, 0);
        return closedFeedback;
      }

      if (prev.type === "success" && onCloseSuccessRef.current) {
        const callback = onCloseSuccessRef.current;
        onCloseSuccessRef.current = null;
        callback();
      }
      return closedFeedback;
    });
  }, [showLoadingToast]);

  const showFeedback = useCallback(
    (next: FeedbackState & { onSuccessClose?: () => void }) => {
      onCloseSuccessRef.current =
        next.type === "success" ? (next.onSuccessClose ?? null) : null;
      setFeedback({
        isOpen: next.isOpen,
        type: next.type,
        title: next.title,
        message: next.message,
      });
    },
    [],
  );

  const runAction = useCallback(
    async (action: () => Promise<void>, options: RunActionOptions) => {
      if (isConfirmingRef.current) {
        setFeedback({
          isOpen: true,
          type: "warning",
          title: OPERATION_COPY.busyConflictDefaultTitle,
          message:
            options.busyConflictMessage ??
            OPERATION_COPY.busyConflictDefaultMessage,
        });
        return;
      }

      setConfirming(true);

      try {
        await action();
        await options.onSuccess?.();
        options.onReleaseLock?.();
        pendingSoftRef.current = null;
        setConfirming(false);
        setRunningMinimized(false);
        setToast(closedToast);
        onCloseSuccessRef.current = options.onSuccessClose ?? null;
        notifyOperationSettled();
        setFeedback({
          isOpen: true,
          type: "success",
          title: options.successTitle,
          message: options.successMessage,
        });
      } catch (error) {
        if (
          isFlowConfirmationTimeoutError(error) &&
          (error.continueConfirm || options.continueConfirm)
        ) {
          const confirmFn =
            error.continueConfirm ?? options.continueConfirm!;
          const release = () => {
            options.onReleaseLock?.();
            error.releaseLock?.();
          };
          options.onSoftTimeout?.();
          onCloseSuccessRef.current = null;

          const gen = ++backgroundGenRef.current;
          pendingSoftRef.current = { gen, options, release };
          setConfirming(true);
          if (options.pendingResourceLock) {
            setPendingResourceLock(options.pendingResourceLock);
          }

          setFeedback({
            isOpen: true,
            type: "info",
            title: options.pendingTitle ?? OPERATION_COPY.pendingDefaultTitle,
            message:
              options.pendingMessage ??
              toFriendlyFlowError(
                error,
                OPERATION_COPY.pendingDefaultMessage,
              ),
            confirmLabel:
              options.pendingConfirmLabel ??
              OPERATION_COPY.pendingConfirmLabel,
          });

          continueConfirmInBackground(confirmFn, {
            backgroundTimeoutMs: options.backgroundTimeoutMs,
            intervalMs: options.backgroundIntervalMs,
            onSettled: (outcome: FlowConfirmOutcome, error?: unknown) => {
              if (gen !== backgroundGenRef.current) return;

              pendingSoftRef.current = null;
              clearPendingOperation();
              setConfirming(false);
              release();

              if (outcome === "confirmed") {
                void Promise.resolve(options.onSuccess?.()).finally(() => {
                  notifyOperationSettled();
                  options.onSuccessClose?.();
                });
              }

              // Cerrar el modal informativo si seguía abierto; resultado solo en toast.
              setFeedback(closedFeedback);
              showSettledToast(outcome, options, error);
            },
          });
          return;
        }

        options.onReleaseLock?.();
        if (isFlowConfirmationTimeoutError(error)) {
          error.releaseLock?.();
        }
        pendingSoftRef.current = null;
        setConfirming(false);
        setRunningMinimized(false);
        setToast(closedToast);
        onCloseSuccessRef.current = null;
        notifyOperationSettled();
        setFeedback({
          isOpen: true,
          type: "error",
          title: options.errorTitle ?? "No se pudo completar la acción",
          message: toFriendlyFlowError(
            error,
            options.errorMessage ??
              "Ocurrió un error inesperado. Intente nuevamente.",
          ),
        });
      }
    },
    [setConfirming, showLoadingToast, showSettledToast],
  );

  useEffect(() => {
    const pending = readPendingOperation();
    if (!pending) return;

    const options: RunActionOptions = {
      successTitle: pending.successTitle,
      successMessage: pending.successMessage,
      errorTitle: "No se pudo completar la operación",
      toastPendingTitle: pending.toastTitle,
      toastPendingMessage: pending.toastMessage,
      onBackgroundFailedMessage: OPERATION_COPY.backgroundFailedDefault,
    };
    const confirm = confirmPendingOperation(pending);
    const gen = ++backgroundGenRef.current;
    setConfirming(true);
    if (pending.watch.kind === "activity" && pending.watch.deliverableId) {
      setPendingResourceLock({
        processId: pending.watch.processId,
        deliverableId: pending.watch.deliverableId,
      });
    }
    showLoadingToast(options);

    const settle = (outcome: FlowConfirmOutcome, error?: unknown) => {
      if (gen !== backgroundGenRef.current) return;
      clearPendingOperation();
      setConfirming(false);
      setFeedback(closedFeedback);
      if (outcome === "confirmed") notifyOperationSettled();
      showSettledToast(outcome, options, error);
    };

    void confirm()
      .then((done) => {
        if (gen !== backgroundGenRef.current) return;
        if (done) {
          settle("confirmed");
          return;
        }
        continueConfirmInBackground(confirm, {
          backgroundTimeoutMs: Math.max(
            1_000,
            PENDING_OPERATION_TTL_MS - (Date.now() - pending.startedAt),
          ),
          intervalMs: 4_000,
          onSettled: settle,
        });
      })
      .catch((error: unknown) => {
        if (gen !== backgroundGenRef.current) return;
        if (isFlowRunFailedError(error)) {
          settle("failed", error);
          return;
        }
        continueConfirmInBackground(confirm, {
          backgroundTimeoutMs: Math.max(
            1_000,
            PENDING_OPERATION_TTL_MS - (Date.now() - pending.startedAt),
          ),
          intervalMs: 4_000,
          onSettled: settle,
        });
      });

    return () => {
      if (gen === backgroundGenRef.current) {
        backgroundGenRef.current += 1;
      }
    };
  }, [setConfirming, showLoadingToast, showSettledToast]);

  const isOperationPending = isConfirming;

  useEffect(() => {
    if (!isOperationPending) return;

    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = OPERATION_COPY.leaveWhilePending;
      return event.returnValue;
    };

    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [isOperationPending]);
  const showRunningIndicator =
    runningMinimized && !toast.isOpen && toast.status === "loading";

  const value = useMemo(
    () => ({
      feedback,
      isOperationPending,
      pendingResourceLock,
      closeFeedback,
      runAction,
      showFeedback,
      dismissToast,
      showRunningIndicator,
      restoreRunningToast,
    }),
    [
      feedback,
      isOperationPending,
      pendingResourceLock,
      closeFeedback,
      runAction,
      showFeedback,
      dismissToast,
      showRunningIndicator,
      restoreRunningToast,
    ],
  );

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
        confirmLabel={
          feedback.confirmLabel ??
          (feedback.type === "success"
            ? OPERATION_COPY.pendingConfirmLabel
            : "Aceptar")
        }
      />
      <OperationToast
        isOpen={toast.isOpen}
        status={toast.status}
        title={toast.title}
        message={toast.message}
        viewActionLabel={toast.viewActionLabel}
        onViewAction={() => onViewActionRef.current?.()}
        onDismiss={dismissToast}
        dismissLabel={OPERATION_COPY.toastDismissLabel}
      />
    </ActionFeedbackContext.Provider>
  );
}

export function useActionFeedback(): ActionFeedbackContextValue {
  const context = useContext(ActionFeedbackContext);
  if (!context) {
    throw new Error(
      "useActionFeedback debe usarse dentro de ActionFeedbackProvider.",
    );
  }
  return context;
}
