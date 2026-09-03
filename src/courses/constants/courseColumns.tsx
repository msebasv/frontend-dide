import {
  IoEyeOutline,
  IoCloudUploadOutline,
} from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import type { Course } from "../types/course.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";

type CourseColumnRole = "author" | "validator" | "advisor" | "designer";

export const getCourseColumns = (role: CourseColumnRole): Column<Course>[] => {
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
      header: "Estado",
      render: (row) => <ProcessStatus status={row.status} />,
    },
    {
      key: "modifiedOn",
      header: "Última modificación",
      render: (row) => (
        <span className="text-xs text-muted">{formatDateTime(row.modifiedOn)}</span>
      ),
    },
    {
      key: "currentRole",
      header: "Rol actual",
      render: (row) => (
        <span className="text-xs font-medium text-muted">
          {formatDomainLabel(row.currentRole)}
        </span>
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
            {role === "author" && row.canUpload && (
              <ActionButton
                to={`/courses/${row.processId}/upload`}
                icon={<IoCloudUploadOutline size={13} />}
                label="Cargar"
                variant="upload"
              />
            )}
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
