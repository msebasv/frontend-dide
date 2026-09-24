/**
 * Construye notificaciones de acción pendiente según el rol activo.
 */
import { PENDING_APPROVAL_PHASES, PROCESS_PHASES, USER_ROLES } from "../constants/domainConstants";
import type { Course } from "../../courses/types/course.types";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";
import type { AppNotification } from "../types/notification.types";

export const buildCourseNotifications = (
  courses: Course[],
  role: string,
): AppNotification[] => {
  if (role === USER_ROLES.AUTHOR) {
    return courses
      .filter((course) => course.canUpload)
      .slice(0, 8)
      .map((course) => ({
        id: `upload-${course.processId}`,
        title: "Material pendiente de carga",
        description: course.processName || course.courseName,
        link: `/courses/${course.processId}/upload`,
        kind: "upload" as const,
      }));
  }

  if (role === USER_ROLES.VALIDATOR || role === USER_ROLES.ADVISOR) {
    return courses
      .filter((course) => course.canValidate || course.canUpload)
      .slice(0, 8)
      .map((course) => {
        const avPending =
          (course.phaseBreakdown?.counts[PROCESS_PHASES.ADVISOR_AV_APPROVAL] ??
            0) > 0;
        const guidePending =
          (course.phaseBreakdown?.counts[PROCESS_PHASES.ADVISOR_GUIDE_UPLOAD] ??
            0) > 0;

        const title =
          role === USER_ROLES.VALIDATOR
            ? "Curso pendiente de validación"
            : avPending
              ? "Pendiente: aprobar material audiovisual DIDE"
              : guidePending
                ? "Pendiente: cargar guión instruccional"
                : "Curso pendiente de asesoría";

        return {
          id: `validate-${course.processId}`,
          title,
          description: course.processName || course.courseName,
          link: `/courses/${course.processId}`,
          kind: "validate" as const,
        };
      });
  }

  if (role === USER_ROLES.DIDE_DESIGNER) {
    return courses
      .filter((course) => course.canFinalize)
      .slice(0, 8)
      .map((course) => ({
        id: `approve-dide-${course.processId}`,
        title: "Curso pendiente de cargue DIDE",
        description: course.processName || course.courseName,
        link: `/courses/${course.processId}`,
        kind: "validate" as const,
      }));
  }

  return [];
};

export const buildLeaderNotifications = (
  processes: VirtualizationProcess[],
): AppNotification[] =>
  processes
    .filter((process) =>
      PENDING_APPROVAL_PHASES.includes(
        process.status as (typeof PENDING_APPROVAL_PHASES)[number],
      ),
    )
    .slice(0, 8)
    .map((process) => ({
      id: `review-${process.processId}`,
      title: "Proceso en espera de aprobación",
      description: process.processName || process.courseName,
      link: `/virtualization-processes/${process.processId}`,
      kind: "review" as const,
    }));
