/**
 * Desglose de fases a partir del estado real de cada entregable.
 * Usado en "Mis cursos" para mostrar pendientes por rol (sin datos de maqueta).
 */
import { PROCESS_PHASES } from "../../global/constants/domainConstants";
import { formatDeliverableState } from "../services/deliverableService";
import type { CoursePhaseBreakdown } from "../types/course.types";

export interface DeliverableStateInput {
  stateLabel: string;
  name?: string;
}

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const isSyllabusProcessStatus = (status: string): boolean => {
  const normalized = normalize(status);
  if (!normalized) return false;
  if (normalized === normalize(PROCESS_PHASES.COMPLETED)) return false;
  if (normalized === normalize(PROCESS_PHASES.LEADER_SYLLABUS)) return true;
  return (
    normalized.includes("syllabus") &&
    (normalized.includes("cargue") ||
      normalized.includes("carga") ||
      normalized.includes("completado") ||
      normalized === "syllabus" ||
      normalized.startsWith("syllabus (") ||
      normalized.startsWith("syllabus lider"))
  );
};
/**
 * Mapea el estado del entregable a la fase de proceso usada por el resumen de UI.
 * Estados intermedios (p. ej. Etapa 2 aprobada) quedan fuera de la fase de acción
 * de validador/asesor para no inflar "pendientes".
 */
export const mapDeliverableStateToPhaseKey = (stateLabel: string): string => {
  const formatted = formatDeliverableState(stateLabel);
  const norm = normalize(formatted);

  if (!norm || norm === "sin estado") {
    return PROCESS_PHASES.AUTHOR_UPLOAD;
  }

  if (norm.includes("aprobado") && !norm.includes("etapa")) {
    return PROCESS_PHASES.COMPLETED;
  }

  if (norm.includes("dide") || norm.includes("confirmacion dide")) {
    return PROCESS_PHASES.DIDE_REVIEW;
  }

  // "En etapa 3" (no "etapa 3 aprobada" si existiera)
  if (
    (norm.includes("etapa 3") || norm.includes("etapa3")) &&
    !norm.includes("aprobad")
  ) {
    return PROCESS_PHASES.ADVISOR_REVIEW;
  }

  // "En etapa 2" activo — excluye "Etapa 2 aprobada"
  if (
    (norm.includes("etapa 2") || norm.includes("etapa2")) &&
    !norm.includes("aprobad")
  ) {
    return PROCESS_PHASES.VALIDATOR_REVIEW;
  }

  // Etapa 2 ya aprobada: en tránsito hacia asesoría (no cuenta como pendiente del validador)
  if (
    (norm.includes("etapa 2") || norm.includes("etapa2")) &&
    norm.includes("aprobad")
  ) {
    return "Etapa 2 aprobada";
  }

  if (
    norm.includes("evaluador") ||
    norm.includes("validador") ||
    norm.includes("revision")
  ) {
    return PROCESS_PHASES.VALIDATOR_REVIEW;
  }

  if (norm.includes("asesor")) {
    return PROCESS_PHASES.ADVISOR_REVIEW;
  }

  if (
    norm.includes("pendiente") ||
    norm.includes("no iniciado") ||
    norm.includes("noiniciado") ||
    norm.includes("devuelto") ||
    norm.includes("corregir") ||
    norm.includes("cargue") ||
    norm.includes("autor")
  ) {
    return PROCESS_PHASES.AUTHOR_UPLOAD;
  }

  return PROCESS_PHASES.AUTHOR_UPLOAD;
};

const bump = (
  counts: Partial<Record<string, number>>,
  key: string,
  amount = 1,
) => {
  counts[key] = (counts[key] ?? 0) + amount;
};

/**
 * Construye el desglose real por entregable.
 * Si el proceso sigue en syllabus, reporta esa fase (no mezclar con materiales).
 */
export const buildPhaseBreakdownFromDeliverables = (
  processStatus: string,
  deliverables: DeliverableStateInput[],
): CoursePhaseBreakdown => {
  if (isSyllabusProcessStatus(processStatus)) {
    return {
      counts: {
        [PROCESS_PHASES.LEADER_SYLLABUS]: Math.max(deliverables.length, 1),
      },
      isMock: false,
    };
  }

  if (deliverables.length === 0) {
    // Sin entregables configurados: un solo bucket según estado del proceso.
    if (isSyllabusProcessStatus(processStatus)) {
      return {
        counts: { [PROCESS_PHASES.LEADER_SYLLABUS]: 1 },
        isMock: false,
      };
    }
    const key = mapDeliverableStateToPhaseKey(processStatus);
    return { counts: { [key]: 1 }, isMock: false };
  }

  const counts: Partial<Record<string, number>> = {};
  for (const item of deliverables) {
    bump(counts, mapDeliverableStateToPhaseKey(item.stateLabel));
  }

  return { counts, isMock: false };
};

/** true si el desglose tiene materiales pendientes de acción para la fase del rol. */
export const breakdownHasActionForRole = (
  breakdown: CoursePhaseBreakdown | undefined,
  phase: string,
): boolean => {
  if (!breakdown) return false;
  return (breakdown.counts[phase] ?? 0) > 0;
};
