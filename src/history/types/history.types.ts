/**
 * Tipos del módulo de historial / auditoría.
 */

/** Registro individual de una actividad en un proceso. */
export interface HistoryEntry {
  id: string;
  processId: string;
  processName: string;
  courseName: string;
  action: string;
  role: string;
  user: string;
  date: string;
  /** Última modificación (útil para devoluciones / aprobaciones). */
  modifiedOn: string;
  comments: string;
  /** Estado crudo de la actividad (Aprobado, Porcorregir...). */
  status: string;
  /**
   * Versión de carga del autor (V1, V2...).
   * Solo aplica a actividades de cargue; undefined en revisiones.
   */
  version?: number;
  /** Carpeta SharePoint del proceso para listar archivos de la actividad. */
  folderBase: string;
  /** Referencia textual de documentos, si existe en Dataverse. */
  documents: string;
}

/** Resumen de un proceso para la tabla principal de historial. */
export interface HistoryProcess {
  processId: string;
  processName: string;
  courseName: string;
  status: string;
  lastModified: string;
  activityCount: number;
}
