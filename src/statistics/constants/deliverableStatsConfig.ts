/**
 * Estados de entregable para gráficas y KPIs de estadísticas.
 */
export const DELIVERABLE_STATS_CONFIG = [
  { key: "Pendiente", label: "Pendiente", color: "#d97706", bucket: "pending" as const },
  { key: "No iniciado", label: "No iniciado", color: "#9ca3af", bucket: "pending" as const },
  { key: "En etapa 2", label: "En etapa 2", color: "#0284c7", bucket: "inReview" as const },
  {
    key: "Etapa 2 aprobada",
    label: "Etapa 2 aprobada",
    color: "#0ea5e9",
    bucket: "inReview" as const,
  },
  { key: "En etapa 3", label: "En etapa 3", color: "#7c3aed", bucket: "inReview" as const },
  { key: "Aprobado", label: "Aprobado", color: "#86c127", bucket: "approved" as const },
] as const;

export type DeliverableStatBucket = (typeof DELIVERABLE_STATS_CONFIG)[number]["bucket"];

export const resolveDeliverableStatBucket = (
  stateLabel: string,
): DeliverableStatBucket | "other" => {
  const match = DELIVERABLE_STATS_CONFIG.find(
    (item) => item.key.toLowerCase() === stateLabel.trim().toLowerCase(),
  );
  return match?.bucket ?? "other";
};
