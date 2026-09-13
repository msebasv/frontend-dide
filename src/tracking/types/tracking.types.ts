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

/** Avance de un entregable (categoría × crédito) dentro del proceso. */
export interface DeliverableTrackingItem {
  id: string;
  name: string;
  creditNumber: number;
  /** General | Crédito / Unidad N */
  creditLabel: string;
  phase: string;
  phaseShort: string;
  authorStatus: ActorProgressCode;
  authorStatusLabel: string;
  validatorStatus: ActorProgressCode;
  validatorStatusLabel: string;
  advisorStatus: ActorProgressCode;
  advisorStatusLabel: string;
  activityCount: number;
}

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
  /** Entregables del proceso agrupables por General / crédito. */
  deliverables: DeliverableTrackingItem[];
}

export interface ProcessTrackingSummary {
  total: number;
  authorPending: number;
  authorReturned: number;
  validatorPending: number;
  advisorPending: number;
  completed: number;
}
