import { IoTimeOutline } from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import type { HistoryProcess } from "../types/history.types";
import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";

export const historyProcessColumns: Column<HistoryProcess>[] = [
  {
    key: "processName",
    header: "Proceso",
    className: "font-medium text-primary",
  },
  { key: "courseName", header: "Curso" },
  {
    key: "status",
    header: "Estado",
    render: (row) => <ProcessStatus status={row.status} />,
  },
  {
    key: "lastModified",
    header: "Última modificación",
    render: (row) => (
      <span className="text-xs text-muted">{formatDateTime(row.lastModified)}</span>
    ),
  },
  {
    key: "activityCount",
    header: "Actividades",
    render: (row) => (
      <span className="text-xs font-medium text-muted">{row.activityCount}</span>
    ),
  },
  {
    key: "processId",
    header: "Acciones",
    render: (row) => (
      <ActionButton
        to={`/history/${row.processId}`}
        icon={<IoTimeOutline size={13} />}
        label="Ver historial"
        variant="view"
      />
    ),
  },
];
