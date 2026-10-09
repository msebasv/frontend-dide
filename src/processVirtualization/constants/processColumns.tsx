import {
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoCreateOutline,
  IoEyeOutline,
  IoTrashOutline,
} from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import type { VirtualizationProcess } from "../types/process.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../components/processStatus";
import CourseProcessStatusSummary from "../../courses/components/courseProcessStatusSummary";
import { formatDateTime } from "../../global/utils/dateUtils";
import { processElapsedLabel } from "../../global/utils/colombiaBusinessDays";
import {
  isLeaderClassroomConfirmStatus,
  isLeaderSyllabusStatus,
} from "../../courses/mappers/courseMappers";
import {
  canAssignDideDesigner,
  canCreateOrEditProcesses,
  canDeleteProcesses,
  canUploadProcessSyllabus,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
/**
 * Columnas del listado global de procesos. El resumen de materiales por estado
 * es el mismo de "Mis cursos": depende del rol que mira la tabla.
 */
export const getVirtualizationProcessColumns = (
  viewerRole: string,
  onDelete?: (row: VirtualizationProcess) => void,
): Column<VirtualizationProcess>[] => [
  {
    key: "processName",
    header: "Proceso",
    className: "font-medium text-primary",
    render: (row) => {
      const closed =
        row.status === PROCESS_PHASES.COMPLETED ? row.modifiedOn : undefined;
      const elapsed = processElapsedLabel(row.createdOn, closed);
      return (
        <div>
          <p>{row.processName}</p>
          {elapsed ? (
            <p className="mt-0.5 text-[11px] font-normal text-muted">
              {elapsed}
            </p>
          ) : null}
        </div>
      );
    },
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
      const isDeleted = Boolean(row.isDeleted);
      const needsValidator =
        !isDeleted &&
        !isFinalized &&
        (row.needsValidatorAssignment ||
          (isLeaderSyllabusStatus(row.status) && !row.validatorEmail?.trim()));
      const needsDesigner =
        !isDeleted && !isFinalized && row.needsDesignerAssignment;
      const canUploadSyllabus =
        !isDeleted &&
        canUploadProcessSyllabus(viewerRole) &&
        !isFinalized &&
        !needsValidator &&
        (row.canUploadSyllabus ||
          (isLeaderSyllabusStatus(row.status) &&
            Boolean(row.validatorEmail?.trim())));
      const canConfirmClassroom =
        !isDeleted &&
        !isFinalized &&
        (row.canConfirmClassroom || isLeaderClassroomConfirmStatus(row.status));
      const canEdit =
        !isDeleted && !isFinalized && canCreateOrEditProcesses(viewerRole);
      const canDelete =
        !isDeleted && Boolean(onDelete) && canDeleteProcesses(viewerRole);
      const canAssignDesigner =
        !isDeleted && !isFinalized && canAssignDideDesigner(viewerRole);

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
          {canDelete && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.(row);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              <IoTrashOutline size={13} />
              Eliminar
            </button>
          )}
        </div>
      );
    },
  },
];
