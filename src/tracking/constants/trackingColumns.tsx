import { Link } from "react-router-dom";
import clsx from "clsx";

import type { Column } from "../../global/components/dataTable";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import type {
  ActorProgressCode,
  ProcessTrackingRow,
} from "../types/tracking.types";

const progressStyles: Record<ActorProgressCode, string> = {
  pending: "bg-warning/10 text-warning",
  returned: "bg-danger/10 text-danger",
  done: "bg-success/10 text-success",
  waiting: "bg-gray-100 text-muted",
  na: "bg-gray-50 text-muted",
};

const ProgressChip = ({
  code,
  label,
}: {
  code: ActorProgressCode;
  label: string;
}) => (
  <span
    className={clsx(
      "inline-flex max-w-full truncate rounded-lg px-2 py-1 text-[11px] font-semibold",
      progressStyles[code],
    )}
    title={label}
  >
    {label}
  </span>
);

export const getTrackingColumns = (): Column<ProcessTrackingRow>[] => [
  {
    key: "processName",
    header: "Proceso",
    className: "font-medium text-primary",
    render: (row) => (
      <div className="min-w-0">
        <Link
          to={row.detailPath}
          className="block truncate font-medium text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.processName}
        </Link>
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
    key: "phase",
    header: "Fase",
    render: (row) => <ProcessStatus status={row.phase} />,
  },
  {
    key: "authorStatusLabel",
    header: "Autor",
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate text-xs text-muted">{row.authorLabel}</p>
        <ProgressChip code={row.authorStatus} label={row.authorStatusLabel} />
      </div>
    ),
  },
  {
    key: "validatorStatusLabel",
    header: "Validador Disciplinar",
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate text-xs text-muted">{row.validatorLabel}</p>
        <ProgressChip
          code={row.validatorStatus}
          label={row.validatorStatusLabel}
        />
      </div>
    ),
  },
  {
    key: "advisorStatusLabel",
    header: "Asesor",
    render: (row) => (
      <div className="min-w-0 space-y-1">
        <p className="truncate text-xs text-muted">{row.advisorLabel}</p>
        <ProgressChip
          code={row.advisorStatus}
          label={row.advisorStatusLabel}
        />
      </div>
    ),
  },
  {
    key: "materialCount",
    header: "Actividades",
    render: (row) => (
      <span className="text-sm font-semibold text-primary">
        {row.materialCount}
      </span>
    ),
  },
  {
    key: "modifiedOn",
    header: "Actualizado",
    render: (row) => (
      <span className="text-xs text-muted">{formatDateTime(row.modifiedOn)}</span>
    ),
  },
];
