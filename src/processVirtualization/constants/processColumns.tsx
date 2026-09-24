import {
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoCreateOutline,
  IoEyeOutline,
} from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import type { VirtualizationProcess } from "../types/process.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../components/processStatus";
import CourseProcessStatusSummary from "../../courses/components/courseProcessStatusSummary";
import { formatDateTime } from "../../global/utils/dateUtils";
import {
  isLeaderClassroomConfirmStatus,
  isLeaderSyllabusStatus,
} from "../../courses/mappers/courseMappers";
import {
  canAssignDideDesigner,
  canCreateOrEditProcesses,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";

/**
 * Columnas del listado global de procesos. El resumen de materiales por estado
 * es el mismo de "Mis cursos": depende del rol que mira la tabla.
 */
export const getVirtualizationProcessColumns = (
  viewerRole: string,
): Column<VirtualizationProcess>[] => [
  {
    key: "processName",
    header: "Proceso",
    className: "font-medium text-primary",
  },
  {
    key: "courseName",
    header: "Curso",
  },
  {
    key: "facultyName",
    header: "Facultad",
    className: "text-muted",
  },
  {
    key: "programName",
    header: "Programa",
    className: "text-muted",
  },
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
      const isFinalized = row.status === PROCESS_PHASES.COMPLETED;
      const needsValidator =
        !isFinalized &&
        (row.needsValidatorAssignment ||
          (isLeaderSyllabusStatus(row.status) && !row.validatorEmail?.trim()));
      const needsDesigner = !isFinalized && row.needsDesignerAssignment;
      const canUploadSyllabus =
        !isFinalized &&
        !needsValidator &&
        (row.canUploadSyllabus ||
          (isLeaderSyllabusStatus(row.status) &&
            Boolean(row.validatorEmail?.trim())));
      const canConfirmClassroom =
        !isFinalized &&
        (row.canConfirmClassroom || isLeaderClassroomConfirmStatus(row.status));
      const canEdit =
        !isFinalized && canCreateOrEditProcesses(viewerRole);
      const canAssignDesigner =
        !isFinalized && canAssignDideDesigner(viewerRole);

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {needsValidator && (
            <ActionButton
              to={`/virtualization-processes/${row.processId}/assign-validator`}
              icon={<IoCreateOutline size={13} />}
              label="Asignar validador"
              variant="edit"
            />
          )}
          {needsDesigner && canAssignDesigner && (
            <ActionButton
              to={`/virtualization-processes/${row.processId}/assign-designer`}
              icon={<IoCreateOutline size={13} />}
              label="Asignar diseñador"
              variant="edit"
            />
          )}
          {canAssignDesigner && !needsDesigner && (
            <ActionButton
              to={`/virtualization-processes/${row.processId}/assign-designer`}
              icon={<IoCreateOutline size={13} />}
              label="Cambiar diseñador"
              variant="edit"
            />
          )}
          {canUploadSyllabus && (
            <ActionButton
              to={`/courses/${row.processId}/upload`}
              icon={<IoCloudUploadOutline size={13} />}
              label="Cargar syllabus"
              variant="upload"
            />
          )}
          {canConfirmClassroom && (
            <ActionButton
              to={`/virtualization-processes/${row.processId}`}
              icon={<IoCheckmarkCircleOutline size={13} />}
              label="Confirmar aula"
              variant="upload"
            />
          )}
          <ActionButton
            to={`/virtualization-processes/${row.processId}`}
            icon={<IoEyeOutline size={13} />}
            label="Ver"
            variant="view"
          />
          {canEdit && (
            <ActionButton
              to={`/virtualization-processes/${row.processId}/edit`}
              icon={<IoCreateOutline size={13} />}
              label="Editar"
              variant="edit"
            />
          )}
        </div>
      );
    },
  },
];
