/**
 * Modal de drill-down: lista de entregables filtrados desde estadísticas.
 */
import { IoEyeOutline, IoListOutline } from "react-icons/io5";

import ActionButton from "../../global/components/actionButton";
import DataTable, { type Column } from "../../global/components/dataTable";
import Modal from "../../global/components/modal";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import type { StatisticsDeliverableRow } from "../types/statistics.types";

interface StatisticsDeliverablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  deliverables: StatisticsDeliverableRow[];
  detailBasePath?: "process" | "course";
}

function StatisticsDeliverablesModal({
  isOpen,
  onClose,
  title,
  deliverables,
  detailBasePath = "process",
}: StatisticsDeliverablesModalProps) {
  const detailPath = (processId: string) =>
    detailBasePath === "course"
      ? `/courses/${processId}`
      : `/virtualization-processes/${processId}`;

  const columns: Column<StatisticsDeliverableRow>[] = [
    {
      key: "name",
      header: "Entregable",
      className: "font-medium text-primary",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-primary">{row.name}</p>
          <p className="truncate text-xs text-muted">{row.creditLabel}</p>
        </div>
      ),
    },
    {
      key: "processName",
      header: "Proceso",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-primary">{row.processName}</p>
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
      key: "stateLabel",
      header: "Estado",
      render: (row) => <ProcessStatus status={row.stateLabel} />,
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
      key: "id",
      header: "Acciones",
      render: (row) => (
        <ActionButton
          to={detailPath(row.processId)}
          icon={<IoEyeOutline size={13} />}
          label="Ver"
          variant="view"
        />
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
        data={deliverables}
        pageSize={8}
        searchable
        searchPlaceholder="Buscar por entregable, proceso o estado..."
        searchKeys={["name", "processName", "courseName", "stateLabel", "facultyName"]}
        emptyMessage="No hay entregables en esta categoría."
        getRowLink={(row) => detailPath(row.processId)}
      />
    </Modal>
  );
}

export default StatisticsDeliverablesModal;
