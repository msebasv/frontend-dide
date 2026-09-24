/**
 * Métricas de dashboard a partir de cursos/procesos ya mapeados.
 */
import {
  PENDING_APPROVAL_PHASES,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
import type { Course, DashboardMetrics } from "../types/course.types";

const COMPLETED_STATUS = PROCESS_PHASES.COMPLETED;

export const computeMetrics = (courses: Course[]): DashboardMetrics => {
  const completed = courses.filter((c) => c.status === COMPLETED_STATUS).length;
  const pendingApproval = courses.filter((c) =>
    PENDING_APPROVAL_PHASES.includes(
      c.status as (typeof PENDING_APPROVAL_PHASES)[number],
    ),
  ).length;
  const inProgress = courses.filter(
    (c) => c.status !== COMPLETED_STATUS && c.status !== PROCESS_PHASES.UNKNOWN,
  ).length;

  return {
    total: courses.length,
    inProgress,
    pendingApproval,
    completed,
  };
};

export const computeLeaderMetrics = (
  processes: { status: string }[],
): DashboardMetrics => {
  const completed = processes.filter(
    (p) => p.status === COMPLETED_STATUS,
  ).length;
  const pendingApproval = processes.filter((p) =>
    PENDING_APPROVAL_PHASES.includes(
      p.status as (typeof PENDING_APPROVAL_PHASES)[number],
    ),
  ).length;
  const inProgress = processes.filter(
    (p) => p.status !== COMPLETED_STATUS && p.status !== PROCESS_PHASES.UNKNOWN,
  ).length;

  return {
    total: processes.length,
    inProgress,
    pendingApproval,
    completed,
  };
};
