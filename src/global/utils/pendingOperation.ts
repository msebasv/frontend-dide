/**
 * Operación en curso que debe sobrevivir a recargar la página.
 * Guarda la foto previa para seguir confirmando en Dataverse.
 */
import { PENDING_ACTION_COPY } from "../constants/operationCopy";

const STORAGE_KEY = "ap:pending-operation";

/** Tope de la espera recuperada. Los flujos largos siguen dentro de este margen. */
export const PENDING_OPERATION_TTL_MS = 2 * 60 * 60 * 1000;

export type PendingPhase = {
  id: string;
  deliverableId: string;
  expectedActivity: string;
  modifiedAt: number;
};

export type PendingActivityWatch = {
  kind: "activity";
  processId: string;
  deliverableId: string;
  actionLabel: string;
  activityIds: string[];
  activityStatusById: Record<string, string>;
  phaseIds: string[];
  phases: PendingPhase[];
  latestPhaseId: string;
  latestPhaseStatus: string;
  beforeDeliverableState: string | null;
};

export type PendingCreateWatch = {
  kind: "create-process";
  processName: string;
  courseId: string;
  idsBefore: string[];
  expectedRoleIds: string[];
  actionLabel: string;
};

export type PendingOperation = {
  startedAt: number;
  /** request-id de table-operation, si esta acción ya lo envía. */
  requestId?: string;
  successTitle: string;
  successMessage: string;
  toastTitle: string;
  toastMessage: string;
  watch: PendingActivityWatch | PendingCreateWatch;
};

type FeedbackCopy = {
  successTitle: string;
  successMessage: string;
  toastTitle: string;
  toastMessage: string;
};

const feedbackForLabel = (actionLabel: string): FeedbackCopy => {
  const normalized = actionLabel.toLowerCase();
  if (normalized.includes("creaci")) {
    return {
      successTitle: "Proceso creado",
      successMessage:
        "El proceso quedó creado. Si no lo ve en la lista, actualice la pantalla.",
      toastTitle: PENDING_ACTION_COPY.createProcess.toastPendingTitle,
      toastMessage: "La creación sigue en procesamiento.",
    };
  }
  if (normalized.includes("aprobaci")) {
    return {
      successTitle: "Material aprobado",
      successMessage:
        "La aprobación terminó. Actualice el detalle si no ve el cambio.",
      toastTitle: PENDING_ACTION_COPY.approveMaterial.toastPendingTitle,
      toastMessage: "La aprobación sigue en procesamiento.",
    };
  }
  if (normalized.includes("devoluci")) {
    return {
      successTitle: "Material devuelto",
      successMessage:
        "La devolución terminó. Actualice el detalle si no ve el cambio.",
      toastTitle: PENDING_ACTION_COPY.returnMaterial.toastPendingTitle,
      toastMessage: "La devolución sigue en procesamiento.",
    };
  }
  if (normalized.includes("cargue") && !normalized.includes("material")) {
    return {
      successTitle: "Cargue registrado",
      successMessage:
        "El registro terminó. Actualice el detalle si no ve el cambio.",
      toastTitle: PENDING_ACTION_COPY.designerUpload.toastPendingTitle,
      toastMessage: "El registro sigue en procesamiento.",
    };
  }
  return {
    successTitle: "Material cargado",
    successMessage:
      "El cargue terminó. Actualice el detalle si no ve el cambio.",
    toastTitle: PENDING_ACTION_COPY.uploadMaterial.toastPendingTitle,
      toastMessage: "La carga sigue en procesamiento.",
  };
};

export const savePendingOperation = (
  watch: PendingActivityWatch | PendingCreateWatch,
  requestId?: string,
): void => {
  const copy = feedbackForLabel(watch.actionLabel);
  const record: PendingOperation = {
    startedAt: Date.now(),
    requestId: requestId?.trim() || undefined,
    ...copy,
    watch,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // sessionStorage puede fallar; la espera en esta página sigue igual.
  }
};

export const readPendingOperation = (): PendingOperation | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOperation;
    if (!parsed?.watch?.kind || !parsed.startedAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.startedAt > PENDING_OPERATION_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingOperation = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
