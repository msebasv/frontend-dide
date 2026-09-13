/**
 * Tipos de dominio del módulo de cursos.
 *
 * Representan la vista de negocio de un proceso de virtualización,
 * no los registros crudos de Dataverse.
 */

/** Resumen de un proceso asignado al usuario actual. */
export interface Course {
  processId: string;
  processName: string;
  courseName: string;
  programName: string;
  facultyName: string;
  authorName: string;
  /** Nombre de la plantilla de actividad de la fase actual. */
  status: string;
  /** Rol responsable según la fase actual (ej. "Autor de asignatura"). */
  currentRole: string;
  /** ISO date de la última actividad, fase o modificación del proceso. */
  modifiedOn: string;
  /** true si el autor puede cargar material en la fase actual. */
  canUpload: boolean;
  /** true si el validador/asesor puede aprobar o devolver en la fase actual. */
  canValidate: boolean;
  /** true si el diseñador DIDE puede aprobar (con Word) en la fase actual. */
  canFinalize: boolean;
  /**
   * Conteo de entregables por fase (datos reales de Dataverse).
   * Si falta, la UI cae al estado único `status`.
   */
  phaseBreakdown?: CoursePhaseBreakdown;
}

/** Conteo de materiales/entregables por nombre de fase. */
export interface CoursePhaseBreakdown {
  counts: Partial<Record<string, number>>;
  /** true solo si los conteos son de demostración (legacy). */
  isMock?: boolean;
}

/** Material académico cargado en una actividad del proceso. */
export interface CourseMaterial {
  activityId: string;
  name: string;
  description: string;
  documents: string;
  /** Estado de la actividad (Aprobado, Devuelto, Por aprobar...). */
  status: string;
  /**
   * Número de versión solo para cargas del autor
   * ("Cargue de documentos por el autor"). Undefined en revisiones.
   */
  version?: number;
  /** true si es una carga de material del autor. */
  isAuthorUpload: boolean;
  /** Nombre de quien realizó la carga, aprobación o devolución. */
  performedBy: string;
  /** Correo de quien realizó la actividad (desde assign-role). */
  performedByEmail: string;
  /** Rol con el que se realizó la actividad (autor, validador, etc.). */
  performedByRole: string;
  /** Fase a la que pertenece la actividad. */
  phaseId: string;
  /**
   * Entregable (categoría × crédito) al que pertenece la fase.
   * Vacío en procesos legacy sin deliverables.
   */
  deliverableId: string;
  /** Fecha de creación del material. */
  createdOn: string;
  /** Última modificación (útil para fecha de aprobación/devolución). */
  modifiedOn: string;
}

/** Archivo asociado a un proceso (SharePoint / almacenamiento). */
export interface ProcessFile {
  name: string;
  path: string;
  /** Ruta exacta para GetFileContentByPath (con biblioteca). */
  connectorPath?: string;
  previewUrl?: string;
  siteUrl?: string;
  /** {Identifier} nativo de SharePoint para GetFileContent. */
  fileId?: string;
  driveItemId?: string;
  listItemId?: number;
  /**
   * Carpeta de versión SharePoint:
   * `v01- Cargue de documentos por el autor - 9e4da645`
   */
  versionFolder?: string;
  /** Número de versión parseado (1, 2, …). */
  versionNumber?: number;
  /** Estado/fase de la carpeta de versión. */
  versionStatusLabel?: string;
  /** Prefijo del id de actividad en la carpeta. */
  activityIdPrefix?: string;
}

/** Vista detallada de un proceso con sus materiales. */
export interface CourseDetail {
  processId: string;
  processName: string;
  courseName: string;
  programName: string;
  facultyName: string;
  folderBase: string;
  status: string;
  currentRole: string;
  materials: CourseMaterial[];
}

/** Métricas agregadas para dashboards (autor, validador, líder). */
export interface DashboardMetrics {
  total: number;
  inProgress: number;
  pendingApproval: number;
  completed: number;
}
