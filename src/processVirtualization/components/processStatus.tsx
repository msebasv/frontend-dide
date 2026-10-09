import { processStatusStyles } from "../constants/processStatusStyles";
import {
  formatDomainLabel,
  normalizeComparableText,
} from "../../global/utils/textUtils";
import {
  PHASE_SHORT_LABELS,
  PROCESS_PHASES,
  VISUAL_CLASSROOM_UPLOAD_LABEL,
} from "../../global/constants/domainConstants";
import {
  isAdvisorAudiovisualApprovalStatus,
  isAdvisorGuideUploadStatus,
  isLeaderClassroomConfirmStatus,
  isLeaderSyllabusStatus,
} from "../../courses/mappers/courseMappers";

interface ProcessStatusProps {
  status: string;
  /**
   * En tablas usa PHASE_SHORT_LABELS (más compacto).
   * En detalle deja el nombre completo de Dataverse.
   */
  compact?: boolean;
}

const normalizeStatusKey = normalizeComparableText;

/** Resuelve la fase canónica para estilo y etiqueta corta en tablas. */
const resolvePhaseKey = (status: string): string | undefined => {
  if (isLeaderSyllabusStatus(status)) return PROCESS_PHASES.LEADER_SYLLABUS;
  if (isLeaderClassroomConfirmStatus(status)) {
    return PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM;
  }
  if (isAdvisorAudiovisualApprovalStatus(status)) {
    return PROCESS_PHASES.ADVISOR_AV_APPROVAL;
  }
  if (isAdvisorGuideUploadStatus(status)) {
    return PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD;
  }

  const lower = normalizeStatusKey(status);
  if (
    lower.includes("enlaces audiovisuales") ||
    (lower.includes("registrar") && lower.includes("enlace"))
  ) {
    return PROCESS_PHASES.DIDE_REVIEW;
  }

  if (
    lower.includes("validador disciplinar") ||
    lower.includes("evaluador") ||
    lower.includes("validador") ||
    lower === normalizeStatusKey(PROCESS_PHASES.VALIDATOR_REVIEW)
  ) {
    return PROCESS_PHASES.VALIDATOR_REVIEW;
  }

  if (processStatusStyles[status]) return status;

  const exactMatch = Object.keys(processStatusStyles).find(
    (key) => key.toLowerCase() === status.toLowerCase(),
  );
  if (exactMatch) return exactMatch;

  if (lower.includes("aprobar material audiovisual")) {
    return PROCESS_PHASES.ADVISOR_AV_APPROVAL;
  }
  if (
    lower.includes("guion instruccional") ||
    lower.includes("guia instruccional") ||
    lower.includes("guion instruct") ||
    lower.includes("guia instruct")
  ) {
    return PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD;
  }
  if (
    lower.includes("aprobado") ||
    lower.includes("finaliz") ||
    lower.includes("complet")
  ) {
    return PROCESS_PHASES.COMPLETED;
  }
  if (
    lower.includes("cargue") ||
    lower.includes("autor") ||
    lower.includes("cargar")
  ) {
    return PROCESS_PHASES.AUTHOR_UPLOAD;
  }
  if (
    lower.includes("asesor") ||
    lower.includes("pedagog")
  ) {
    return PROCESS_PHASES.ADVISOR_REVIEW;
  }
  if (
    lower.includes("revis") ||
    lower.includes("evalua") ||
    lower.includes("valida")
  ) {
    return PROCESS_PHASES.VALIDATOR_REVIEW;
  }

  return undefined;
};

const resolveStatusStyle = (status: string): string => {
  const phaseKey = resolvePhaseKey(status);
  if (phaseKey && processStatusStyles[phaseKey]) {
    return processStatusStyles[phaseKey];
  }

  const lower = normalizeStatusKey(status);
  if (
    lower.includes("devuelto") ||
    lower.includes("corregir") ||
    lower.includes("rechaz")
  ) {
    return "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/25";
  }

  return "bg-[#004040]/10 text-[#004040] border border-[#004040]/25";
};

/** Estado completo de Dataverse, con capitalización legible. */
const toUiStatusLabel = (status: string): string => formatDomainLabel(status);

const resolveStatusLabel = (status: string, compact: boolean): string => {
  if (!status.trim()) return PROCESS_PHASES.UNKNOWN;
  // No usar la etiqueta corta de la validación real del aula.
  if (
    normalizeStatusKey(status) ===
    normalizeStatusKey(VISUAL_CLASSROOM_UPLOAD_LABEL)
  ) {
    return VISUAL_CLASSROOM_UPLOAD_LABEL;
  }
  if (compact) {
    const phaseKey = resolvePhaseKey(status);
    if (phaseKey && PHASE_SHORT_LABELS[phaseKey]) {
      return PHASE_SHORT_LABELS[phaseKey];
    }
  }
  return toUiStatusLabel(status);
};

export const ProcessStatus = ({
  status,
  compact = false,
}: ProcessStatusProps) => {
  const style = resolveStatusStyle(status);
  const label = resolveStatusLabel(status, compact);
  const fullLabel = status ? toUiStatusLabel(status) : label;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-semibold sm:px-3 ${style}`}
      title={fullLabel}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
};
