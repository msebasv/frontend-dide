import { IoCreateOutline, IoEyeOutline } from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import type { VirtualizationProcess } from "../types/process.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";

export const virtualizationProcessColumns: Column<VirtualizationProcess>[] = [
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
    key: "processId",
    header: "Acciones",
    render: (row) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionButton
          to={`/virtualization-processes/${row.processId}`}
          icon={<IoEyeOutline size={13} />}
          label="Ver"
          variant="view"
        />
        <ActionButton
          to={`/virtualization-processes/${row.processId}/edit`}
          icon={<IoCreateOutline size={13} />}
          label="Editar"
          variant="edit"
        />
      </div>
    ),
  },
];
