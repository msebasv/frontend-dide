/**
 * Tablero de seguimiento de procesos (cargas / validaciones).
 * Asesor: solo asignados. Líder / Coordinador / Admin: todos.
 */

export type ActorProgressCode =
  | "pending"
  | "done"
  | "returned"
  | "waiting"
  | "na";

export interface ProcessTrackingRow {
  processId: string;
  processName: string;
  courseName: string;
  facultyName: string;
  phase: string;
  phaseShort: string;
  authorEmail: string;
  authorLabel: string;
  authorStatus: ActorProgressCode;
  authorStatusLabel: string;
  validatorEmail: string;
  validatorLabel: string;
  validatorStatus: ActorProgressCode;
  validatorStatusLabel: string;
  advisorEmail: string;
  advisorLabel: string;
  advisorStatus: ActorProgressCode;
  advisorStatusLabel: string;
  materialCount: number;
  modifiedOn: string;
  /** Ruta de detalle según el rol que consulta. */
  detailPath: string;
}

export interface ProcessTrackingSummary {
  total: number;
  authorPending: number;
  authorReturned: number;
  validatorPending: number;
  advisorPending: number;
  completed: number;
}
