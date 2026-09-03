/**
 * Estilos visuales por fase del proceso de virtualización.
 * Las claves coinciden con PROCESS_PHASES en domainConstants.
 * Cada fase usa un color distinto para identificarla de un vistazo.
 */
import { PROCESS_PHASES } from "../../global/constants/domainConstants";

export const processStatusStyles: Record<string, string> = {
  /** Ámbar — pendiente de carga del autor */
  [PROCESS_PHASES.AUTHOR_UPLOAD]:
    "bg-amber-100 text-amber-900 ring-1 ring-amber-300/70",
  /** Azul — revisión validador disciplinar */
  [PROCESS_PHASES.VALIDATOR_REVIEW]:
    "bg-sky-100 text-sky-900 ring-1 ring-sky-300/70",
  /** Violeta — revisión asesor pedagógico */
  [PROCESS_PHASES.ADVISOR_REVIEW]:
    "bg-violet-100 text-violet-900 ring-1 ring-violet-300/70",
  /** Teal marca — confirmación DIDE */
  [PROCESS_PHASES.DIDE_REVIEW]:
    "bg-primary/10 text-primary ring-1 ring-primary/30",
  /** Verde — syllabus completado */
  [PROCESS_PHASES.COMPLETED]:
    "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/70",
};

/** Colores hex para gráficas y badges (Recharts, PhaseDistribution, etc.). */
export const processStatusColors: Record<string, string> = {
  [PROCESS_PHASES.AUTHOR_UPLOAD]: "#d97706",
  [PROCESS_PHASES.VALIDATOR_REVIEW]: "#0284c7",
  [PROCESS_PHASES.ADVISOR_REVIEW]: "#7c3aed",
  [PROCESS_PHASES.DIDE_REVIEW]: "#004040",
  [PROCESS_PHASES.COMPLETED]: "#059669",
};
