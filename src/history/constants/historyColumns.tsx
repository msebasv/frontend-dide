import { IoEyeOutline } from "react-icons/io5";

import type { HistoryEntry } from "../types/history.types";
import type { Column } from "../../global/components/dataTable";
import { formatDateTime } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { formatActivityStatus } from "../../courses/mappers/courseMappers";

const statusStyle = (statusLabel: string): string => {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "bg-success/10 text-success";
  }
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "bg-danger/10 text-danger";
  }
  if (normalized.includes("por aprobar") || normalized.includes("proceso")) {
    return "bg-warning/10 text-warning";
  }

  return "bg-gray-100 text-muted";
};

const StatusBadge = ({ status }: { status: string }) => {
  const label = formatActivityStatus(status);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle(label)}`}
    >
      {label}
    </span>
  );
};

export const historyColumns: Column<HistoryEntry>[] = [
  { key: "processName", header: "Proceso" },
  { key: "courseName", header: "Curso" },
  {
    key: "action",
    header: "Acción",
    render: (row) => formatDomainLabel(row.action),
  },
  {
    key: "version",
    header: "Versión",
    render: (row) =>
      row.version != null ? (
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
          V{row.version}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: "status",
    header: "Estado",
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "role",
    header: "Rol",
    render: (row) => formatDomainLabel(row.role),
  },
  { key: "user", header: "Usuario" },
  {
    key: "date",
    header: "Fecha",
    render: (row) => formatDateTime(row.date),
  },
  {
    key: "comments",
    header: "Comentarios",
    render: (row) => (
      <span className="max-w-xs truncate text-gray-600">
        {row.comments || "—"}
      </span>
    ),
  },
];

export const getHistoryDetailColumns = (
  onViewDetail: (entry: HistoryEntry) => void,
): Column<HistoryEntry>[] => [
  {
    key: "action",
    header: "Acción",
    render: (row) => formatDomainLabel(row.action),
  },
  {
    key: "version",
    header: "Versión",
    render: (row) =>
      row.version != null ? (
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
          V{row.version}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: "status",
    header: "Estado",
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "date",
    header: "Fecha",
    render: (row) => formatDateTime(row.date),
  },
  {
    key: "id",
    header: "Acciones",
    render: (row) => (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onViewDetail(row);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-muted transition-all duration-150 hover:border-primary/20 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-offset-1 active:scale-[0.98]"
      >
        <IoEyeOutline size={13} />
        Ver detalle
      </button>
    ),
  },
];
