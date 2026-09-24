/**
 * Estilos visuales por fase del proceso de virtualización.
 * Las claves coinciden con PROCESS_PHASES en domainConstants.
 *
 * Mismo lenguaje visual del ActionButton "edit" / Cambiar diseñador:
 * fondo suave /10 · texto de paleta · borde /25
 * Paleta dashboard: #d97706 · #004040 · #005555 · #86c127 · #5ea018 · #9ad43a
 */
import { PROCESS_PHASES } from "../../global/constants/domainConstants";

export const processStatusStyles: Record<string, string> = {
  /** Naranja — syllabus */
  [PROCESS_PHASES.LEADER_SYLLABUS]:
    "bg-[#d97706]/10 text-[#d97706] border border-[#d97706]/25",
  /** Naranja — cargue del autor */
  [PROCESS_PHASES.AUTHOR_UPLOAD]:
    "bg-[#d97706]/10 text-[#d97706] border border-[#d97706]/25",
  /** Verde oscuro — validador disciplinar */
  [PROCESS_PHASES.VALIDATOR_REVIEW]:
    "bg-[#004040]/10 text-[#004040] border border-[#004040]/25",
  /** Teal — asesor pedagógico */
  [PROCESS_PHASES.ADVISOR_REVIEW]:
    "bg-[#005555]/10 text-[#005555] border border-[#005555]/25",
  /** Verde claro — guión instruccional */
  [PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD]:
    "bg-[#86c127]/10 text-[#3f8f2a] border border-[#86c127]/25",
  /** Verde oscuro — enlaces audiovisuales DIDE */
  [PROCESS_PHASES.DIDE_REVIEW]:
    "bg-[#004040]/10 text-[#004040] border border-[#004040]/25",
  /** Verde acento — aprobación AV */
  [PROCESS_PHASES.ADVISOR_AV_APPROVAL]:
    "bg-[#5ea018]/10 text-[#3f8f2a] border border-[#5ea018]/25",
  /** Lima — validación aula */
  [PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM]:
    "bg-[#9ad43a]/10 text-[#3f8f2a] border border-[#9ad43a]/25",
  /** Verde claro — proceso finalizado */
  [PROCESS_PHASES.COMPLETED]:
    "bg-[#86c127]/10 text-[#3f8f2a] border border-[#86c127]/25",
};

/** Colores hex para gráficas y badges (Recharts, PhaseDistribution, etc.). */
export const processStatusColors: Record<string, string> = {
  [PROCESS_PHASES.LEADER_SYLLABUS]: "#d97706",
  [PROCESS_PHASES.AUTHOR_UPLOAD]: "#d97706",
  [PROCESS_PHASES.VALIDATOR_REVIEW]: "#004040",
  [PROCESS_PHASES.ADVISOR_REVIEW]: "#005555",
  [PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD]: "#86c127",
  [PROCESS_PHASES.DIDE_REVIEW]: "#004040",
  [PROCESS_PHASES.ADVISOR_AV_APPROVAL]: "#5ea018",
  [PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM]: "#9ad43a",
  [PROCESS_PHASES.COMPLETED]: "#86c127",
};
