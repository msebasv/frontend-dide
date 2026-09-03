import { IoEyeOutline, IoListOutline, IoTimeOutline } from "react-icons/io5";
import { Link } from "react-router-dom";

import ActionButton from "../../global/components/actionButton";
import DataTable, { type Column } from "../../global/components/dataTable";
import Modal from "../../global/components/modal";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import type { VirtualizationProcess } from "../../processVirtualization/types/process.types";

interface StatisticsProcessesModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  processes: VirtualizationProcess[];
  detailBasePath?: "process" | "course";
}

function StatisticsProcessesModal({
  isOpen,
  onClose,
  title,
  processes,
  detailBasePath = "process",
}: StatisticsProcessesModalProps) {
  const detailPath = (processId: string) =>
    detailBasePath === "course"
      ? `/courses/${processId}`
      : `/virtualization-processes/${processId}`;

  const columns: Column<VirtualizationProcess>[] = [
    {
      key: "processName",
      header: "Proceso",
      className: "font-medium text-primary",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-primary">{row.processName}</p>
          <p className="truncate text-xs text-muted">{row.courseName}</p>
        </div>
      ),
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
      key: "advisorLabel",
      header: "Responsables",
      render: (row) => (
        <div className="min-w-0 space-y-0.5 text-xs text-muted">
          {row.authorLabel && (
            <p className="truncate">
              <span className="font-semibold text-primary/70">Autor:</span>{" "}
              {row.authorLabel}
            </p>
          )}
          {row.validatorLabel && (
            <p className="truncate">
              <span className="font-semibold text-primary/70">Validador:</span>{" "}
              {row.validatorLabel}
            </p>
          )}
          {row.advisorLabel && (
            <p className="truncate">
              <span className="font-semibold text-primary/70">Asesor:</span>{" "}
              {row.advisorLabel}
            </p>
          )}
          {row.leaderLabel && (
            <p className="truncate">
              <span className="font-semibold text-primary/70">Líder:</span>{" "}
              {row.leaderLabel}
            </p>
          )}
          {!row.authorLabel &&
            !row.validatorLabel &&
            !row.advisorLabel &&
            !row.leaderLabel && <span>—</span>}
        </div>
      ),
    },
    {
      key: "modifiedOn",
      header: "Actualizado",
      render: (row) => (
        <span className="text-xs text-muted">
          {formatDateTime(row.modifiedOn)}
        </span>
      ),
    },
    {
      key: "processId",
      header: "Acciones",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <ActionButton
            to={detailPath(row.processId)}
            icon={<IoEyeOutline size={13} />}
            label="Ver"
            variant="view"
          />
          <Link
            to={`/history/${row.processId}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-muted transition-all duration-150 hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
          >
            <IoTimeOutline size={13} />
            Historial
          </Link>
        </div>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={<IoListOutline size={18} />}
      size="full"
    >
      <DataTable
        columns={columns}
        data={processes}
        pageSize={8}
        searchable
        searchPlaceholder="Buscar proceso, curso, facultad..."
        searchKeys={[
          "processName",
          "courseName",
          "facultyName",
          "programName",
          "status",
          "authorLabel",
          "validatorLabel",
          "advisorLabel",
          "leaderLabel",
        ]}
        emptyMessage="No hay procesos en esta categoría"
        getRowLink={(row) => detailPath(row.processId)}
      />
    </Modal>
  );
}

export default StatisticsProcessesModal;
