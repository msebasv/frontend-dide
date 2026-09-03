import { processStatusStyles } from "../constants/processStatusStyles";
import { formatDomainLabel } from "../../global/utils/textUtils";

interface ProcessStatusProps {
  status: string;
}

const resolveStatusStyle = (status: string): string => {
  if (processStatusStyles[status]) return processStatusStyles[status];

  const match = Object.keys(processStatusStyles).find(
    (key) => key.toLowerCase() === status.toLowerCase(),
  );

  return match
    ? processStatusStyles[match]
    : "bg-gray-50 text-gray-600 ring-1 ring-gray-200/60";
};

export const ProcessStatus = ({ status }: ProcessStatusProps) => {
  const style = resolveStatusStyle(status);
  const label = status ? formatDomainLabel(status) : "Sin estado";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold sm:px-3 ${style}`}
      title={label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
};
