/**
 * Tipos del módulo de procesos de virtualización (vista global del líder).
 */
import type { CoursePhaseBreakdown } from "../../courses/types/course.types";

/** Datos para el formulario de edición del líder. */
export interface ProcessEditData {
  processId: string;
  processName: string;
  courseId: string;
  courseName: string;
  /** Número de créditos del proceso. */
  credits: number;
  leaderEmail: string;
  authorEmail: string;
  validatorEmail: string;
  advisorEmail: string;
  /** Diseñador DIDE asignado al proceso (opcional hasta la fase de guión). */
  designerEmail: string;
  /** true si close-ready: el proceso ya no se puede editar. */
  isFinalized: boolean;
}

export interface VirtualizationProcess {
  processId: string;
  processName: string;
  courseName: string;
  programName: string;
  facultyName: string;
  /** Nombre de la plantilla de la fase actual. */
  status: string;
  modifiedOn: string;
  /** Semestre académico resuelto, p. ej. "2026-1". */
  semester: string;
  createdOn: string;
  /** Correo del autor asignado (si existe). */
  authorEmail: string;
  /** Etiqueta visible del autor (nombre o correo). */
  authorLabel: string;
  /** Correo del validador disciplinar asignado (si existe). */
  validatorEmail: string;
  /** Etiqueta visible del validador (nombre o correo). */
  validatorLabel: string;
  /** Correo del asesor pedagógico asignado (si existe). */
  advisorEmail: string;
  /** Etiqueta visible del asesor (nombre o correo). */
  advisorLabel: string;
  /** Correo del líder de virtualización asignado (si existe). */
  leaderEmail: string;
  /** Etiqueta visible del líder (nombre o correo). */
  leaderLabel: string;
  /** Correo del diseñador DIDE asignado (si existe). */
  designerEmail: string;
  /** Etiqueta visible del diseñador DIDE (nombre o correo). */
  designerLabel: string;
  /** true si el proceso está en fase de carga de syllabus del líder. */
  canUploadSyllabus: boolean;
  /**
   * true si el syllabus está pendiente pero aún falta asignar el validador.
   */
  needsValidatorAssignment: boolean;
  /**
   * true si aún no hay Diseñador DIDE (el coordinador puede asignarlo
   * en cualquier momento desde la creación del proceso).
   */
  needsDesignerAssignment: boolean;
  /**
   * true si el líder puede confirmar el cargue en el aula
   * (cierre del proceso tras el audiovisual DIDE).
   */
  canConfirmClassroom: boolean;
  /**
   * Conteo de entregables por fase (datos reales de Dataverse).
   * Si falta, la UI cae al estado único `status`.
   */
  phaseBreakdown?: CoursePhaseBreakdown;
}
