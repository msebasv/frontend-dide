/**
 * Utilidades de formato y comparación de fechas.
 * Usadas en listas, historial y cálculo de modifiedOn.
 */

/** Formatea una fecha ISO para mostrar en la UI (locale es-CO). */
export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return "—";

  try {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

/**
 * Retorna la fecha más reciente entre varias fechas ISO opcionales.
 * Usado para calcular la última modificación de un proceso.
 */
export const getLatestDate = (...dates: (string | undefined)[]): string => {
  const timestamps = dates
    .filter(Boolean)
    .map((date) => new Date(date!).getTime())
    .filter((time) => !Number.isNaN(time));

  if (timestamps.length === 0) return "";

  return new Date(Math.max(...timestamps)).toISOString();
};

/**
 * Retorna el timestamp numérico más reciente entre modifiedon y createdon de un registro Dataverse.
 * Esencial para fases y entregables que se actualizan in-place (cambio de expected-activity).
 */
export const getRecordTimestamp = (record?: {
  modifiedon?: string;
  createdon?: string;
}): number => {
  if (!record) return 0;
  const mod = record.modifiedon ? new Date(record.modifiedon).getTime() : 0;
  const cre = record.createdon ? new Date(record.createdon).getTime() : 0;
  return Math.max(
    Number.isNaN(mod) ? 0 : mod,
    Number.isNaN(cre) ? 0 : cre,
  );
};
