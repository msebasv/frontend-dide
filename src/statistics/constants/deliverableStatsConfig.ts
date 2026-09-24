/**
 * Estados de entregable para gráficas y KPIs de estadísticas.
 * Misma paleta sólida del dashboard (#d97706 · #004040 · #86c127 · …).
 */
import { DELIVERABLE_STATES } from "../../global/constants/domainConstants";

export const DELIVERABLE_STATS_CONFIG = [
  {
    key: DELIVERABLE_STATES.PENDING,
    label: DELIVERABLE_STATES.PENDING,
    color: "#d97706",
    bucket: "pending" as const,
  },
  {
    key: DELIVERABLE_STATES.NOT_STARTED,
    label: DELIVERABLE_STATES.NOT_STARTED,
    color: "#6b7a72",
    bucket: "pending" as const,
  },
  {
    key: DELIVERABLE_STATES.STAGE_2,
    label: DELIVERABLE_STATES.STAGE_2,
    color: "#004040",
    bucket: "inReview" as const,
  },
  {
    key: DELIVERABLE_STATES.STAGE_2_APPROVED,
    label: DELIVERABLE_STATES.STAGE_2_APPROVED,
    color: "#005555",
    bucket: "inReview" as const,
  },
  {
    key: DELIVERABLE_STATES.STAGE_3,
    label: DELIVERABLE_STATES.STAGE_3,
    color: "#5ea018",
    bucket: "inReview" as const,
  },
  {
    key: DELIVERABLE_STATES.APPROVED,
    label: DELIVERABLE_STATES.APPROVED,
    color: "#86c127",
    bucket: "approved" as const,
  },
] as const;

export type DeliverableStatBucket =
  (typeof DELIVERABLE_STATS_CONFIG)[number]["bucket"];

export const resolveDeliverableStatBucket = (
  stateLabel: string,
): DeliverableStatBucket | "other" => {
  const match = DELIVERABLE_STATS_CONFIG.find(
    (item) => item.key.toLowerCase() === stateLabel.trim().toLowerCase(),
  );
  return match?.bucket ?? "other";
};
