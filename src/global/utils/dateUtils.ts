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
