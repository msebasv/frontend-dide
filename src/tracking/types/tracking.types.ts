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
  /** General | Unidad N */
  creditLabel: string;
  phase: string;
  phaseShort: string;
  /** Pre validación documental — Líder (syllabus). */
  leaderPreStatus: ActorProgressCode;
  leaderPreStatusLabel: string;
  /** Fase documental. */
  authorStatus: ActorProgressCode;
  authorStatusLabel: string;
  validatorStatus: ActorProgressCode;
  validatorStatusLabel: string;
  advisorStatus: ActorProgressCode;
  advisorStatusLabel: string;
  /** Creación documental DIDE. */
  designerStatus: ActorProgressCode;
  designerStatusLabel: string;
  advisorAvStatus: ActorProgressCode;
  advisorAvStatusLabel: string;
  /** Validación cargue en el aula — Líder. */
  leaderClassroomStatus: ActorProgressCode;
  leaderClassroomStatusLabel: string;
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
  /** Pendiente de aprobación AV DIDE (asesor). */
  advisorAvStatus: ActorProgressCode;
  advisorAvStatusLabel: string;
  designerEmail: string;
  designerLabel: string;
  designerStatus: ActorProgressCode;
  designerStatusLabel: string;
  leaderPreStatus: ActorProgressCode;
  leaderPreStatusLabel: string;
  leaderClassroomStatus: ActorProgressCode;
  leaderClassroomStatusLabel: string;
  /**
   * true si aún no hay Diseñador DIDE (asignable en cualquier momento).
   */
  needsDesignerAssignment: boolean;
  /** true si close-ready: solo consulta, sin reasignar ni editar. */
  isFinalized: boolean;
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
