import { IoEyeOutline } from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import type { Course } from "../types/course.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import CourseProcessStatusSummary from "../components/courseProcessStatusSummary";
import { formatDateTime } from "../../global/utils/dateUtils";

type CourseColumnRole = "author" | "validator" | "advisor" | "designer";

const viewerRoleLabel: Record<CourseColumnRole, string> = {
  author: "Autor de asignatura",
  validator: "Validador disciplinar",
  advisor: "Asesor pedagógico",
  designer: "Diseñador DIDE",
};

export const getCourseColumns = (role: CourseColumnRole): Column<Course>[] => {
  const viewerRole = viewerRoleLabel[role];

  const baseColumns: Column<Course>[] = [
    {
      key: "processName",
      header: "Proceso",
      className: "font-medium text-primary",
    },
    { key: "courseName", header: "Curso" },
  ];

  if (role !== "author") {
    baseColumns.push({
      key: "authorName",
      header: "Autor",
      className: "text-muted",
    });
  }

  baseColumns.push(
    {
      key: "status",
      header: "Pendiente para ti",
      render: (row) =>
        row.phaseBreakdown ? (
          <CourseProcessStatusSummary
            breakdown={row.phaseBreakdown}
            viewerRole={viewerRole}
          />
        ) : (
          <ProcessStatus status={row.status} />
        ),
    },
    {
      key: "modifiedOn",
      header: "Última modificación",
      render: (row) => (
        <span className="text-xs text-muted">{formatDateTime(row.modifiedOn)}</span>
      ),
    },
    {
      key: "processId",
      header: "Acciones",
      render: (row) => {
        const actionLabel = row.canValidate
          ? "Validar"
          : row.canFinalize
            ? "Aprobar"
            : "Ver";
        const actionVariant = row.canValidate
          ? "validate"
          : row.canFinalize
            ? "validate"
            : "view";

        return (
          <div className="flex flex-wrap gap-1.5">
            <ActionButton
              to={`/courses/${row.processId}`}
              icon={<IoEyeOutline size={13} />}
              label={actionLabel}
              variant={actionVariant}
            />
          </div>
        );
      },
    },
  );

  return baseColumns;
};
