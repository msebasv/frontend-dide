import { processStatusStyles } from "../constants/processStatusStyles";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { PROCESS_PHASES } from "../../global/constants/domainConstants";
import { isLeaderSyllabusStatus } from "../../courses/mappers/courseMappers";

interface ProcessStatusProps {
  status: string;
}

const resolveStatusStyle = (status: string): string => {
  if (isLeaderSyllabusStatus(status)) {
    return processStatusStyles[PROCESS_PHASES.LEADER_SYLLABUS];
  }

  if (processStatusStyles[status]) return processStatusStyles[status];

  const match = Object.keys(processStatusStyles).find(
    (key) => key.toLowerCase() === status.toLowerCase(),
  );

  if (match) return processStatusStyles[match];

  const lower = status.toLowerCase();
  if (
    lower.includes("devuelto") ||
    lower.includes("corregir") ||
    lower.includes("rechaz")
  ) {
    return "bg-rose-100 text-rose-900 ring-1 ring-rose-300/70";
  }
  if (
    lower.includes("aprobado") ||
    lower.includes("finaliz") ||
    lower.includes("complet")
  ) {
    return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/70";
  }
  if (lower.includes("cargue") || lower.includes("autor")) {
    return "bg-amber-100 text-amber-900 ring-1 ring-amber-300/70";
  }
  if (
    lower.includes("revis") ||
    lower.includes("evalua") ||
    lower.includes("valida")
  ) {
    return "bg-sky-100 text-sky-900 ring-1 ring-sky-300/70";
  }

  return "bg-gray-50 text-gray-600 ring-1 ring-gray-200/60";
};

/** Etiqueta de UI: Dataverse puede traer "evaluador"; mostrar siempre Validador Disciplinar. */
const toUiStatusLabel = (status: string): string =>
  formatDomainLabel(status).replace(
    /evaluadores?/gi,
    "Validador Disciplinar",
  );

const resolveStatusLabel = (status: string): string => {
  if (!status.trim()) return "Sin estado";
  if (isLeaderSyllabusStatus(status)) return "Cargue Syllabus";
  return toUiStatusLabel(status);
};

export const ProcessStatus = ({ status }: ProcessStatusProps) => {
  const style = resolveStatusStyle(status);
  const label = resolveStatusLabel(status);

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold sm:px-3 ${style}`}
      title={status ? toUiStatusLabel(status) : label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
};
