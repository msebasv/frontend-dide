/**
 * Tipos del módulo de procesos de virtualización (vista global del líder).
 */

/** Datos para el formulario de edición del líder. */
export interface ProcessEditData {
  processId: string;
  processName: string;
  courseId: string;
  courseName: string;
  leaderEmail: string;
  authorEmail: string;
  validatorEmail: string;
  advisorEmail: string;
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
}
