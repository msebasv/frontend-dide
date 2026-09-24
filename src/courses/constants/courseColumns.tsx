import type { ReactNode } from "react";
import { IoCloudUploadOutline, IoEyeOutline } from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import type { Course } from "../types/course.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import CourseProcessStatusSummary from "../components/courseProcessStatusSummary";
import { formatDateTime } from "../../global/utils/dateUtils";
import { isCompletedProcessStatus } from "../../global/components/processStatusFilterTabs";
import { USER_ROLES } from "../../global/constants/domainConstants";

type CourseColumnRole = "author" | "validator" | "advisor" | "designer";

const viewerRoleLabel: Record<CourseColumnRole, string> = {
  author: USER_ROLES.AUTHOR,
  validator: USER_ROLES.VALIDATOR,
  advisor: USER_ROLES.ADVISOR,
  designer: USER_ROLES.DIDE_DESIGNER,
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
      header: "Materiales por estado",
      render: (row) =>
        row.phaseBreakdown ? (
          <CourseProcessStatusSummary
            breakdown={row.phaseBreakdown}
            viewerRole={viewerRole}
          />
        ) : (
          <ProcessStatus status={row.status} compact />
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
        const actions: ReactNode[] = [];
        const isFinalized = isCompletedProcessStatus(row.status);

        // Autor, validador y asesor siempre pueden abrir el detalle.
        if (role === "author" || role === "validator" || role === "advisor") {
          actions.push(
            <ActionButton
              key="view"
              to={`/courses/${row.processId}`}
              icon={<IoEyeOutline size={13} />}
              label="Ver"
              variant="view"
            />,
          );
        }

        if (row.canValidate && !isFinalized) {
          actions.push(
            <ActionButton
              key="validate"
              to={`/courses/${row.processId}`}
              icon={<IoEyeOutline size={13} />}
              label="Validar"
              variant="validate"
            />,
          );
        }

        if (row.canFinalize && !isFinalized) {
          actions.push(
            <ActionButton
              key="finalize"
              to={`/courses/${row.processId}`}
              icon={<IoEyeOutline size={13} />}
              label="Cargar"
              variant="validate"
            />,
          );
        }

        // Cargue de material (autor) desde la tabla. El asesor carga el guión
        // solo desde el detalle del entregable, no con un botón aquí.
        if (row.canUpload && role !== "advisor" && !isFinalized) {
          actions.push(
            <ActionButton
              key="upload"
              to={`/courses/${row.processId}`}
              icon={<IoCloudUploadOutline size={13} />}
              label="Cargar"
              variant="upload"
            />,
          );
        }

        if (actions.length === 0) {
          actions.push(
            <ActionButton
              key="view"
              to={`/courses/${row.processId}`}
              icon={<IoEyeOutline size={13} />}
              label="Ver"
              variant="view"
            />,
          );
        }

        return <div className="flex flex-wrap gap-1.5">{actions}</div>;
      },
    },
  );

  return baseColumns;
};
