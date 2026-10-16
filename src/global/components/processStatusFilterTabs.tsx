/**
 * Tabs Todos / En curso / Finalizados para listados de procesos y cursos.
 */
import clsx from "clsx";
import {
  IoCheckmarkDoneOutline,
  IoListOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { PROCESS_PHASES } from "../constants/domainConstants";

/** Pestaña de filtro por estado del proceso o curso. */
export type ProcessStatusFilterTab = "all" | "inProgress" | "completed";

/** Definición de pestañas Todos / En curso / Finalizados. */
export const PROCESS_STATUS_FILTER_TABS: Array<{
  id: ProcessStatusFilterTab;
  label: string;
  icon: typeof IoListOutline;
}> = [
  { id: "all", label: "Todos", icon: IoListOutline },
  { id: "inProgress", label: "En curso", icon: IoTimeOutline },
  { id: "completed", label: "Finalizados", icon: IoCheckmarkDoneOutline },
];

/** Indica si el estado corresponde a proceso finalizado. */
export const isCompletedProcessStatus = (status: string): boolean =>
  status === PROCESS_PHASES.COMPLETED;

/** Filtra una lista según la pestaña de estado activa. */
export const filterByProcessStatusTab = <T,>(
  items: T[],
  tab: ProcessStatusFilterTab,
  getStatus: (item: T) => string,
): T[] => {
  if (tab === "completed") {
    return items.filter((item) => isCompletedProcessStatus(getStatus(item)));
  }
  if (tab === "inProgress") {
    return items.filter((item) => !isCompletedProcessStatus(getStatus(item)));
  }
  return items;
};

/** Cuenta ítems por pestaña (todos, en curso, finalizados). */
export const countByProcessStatusTab = <T,>(
  items: T[],
  getStatus: (item: T) => string,
): Record<ProcessStatusFilterTab, number> => {
  const completed = items.filter((item) =>
    isCompletedProcessStatus(getStatus(item)),
  ).length;
  return {
    all: items.length,
    inProgress: items.length - completed,
    completed,
  };
};

/** Título de listado según pestaña y etiqueta de entidad. */
export const processStatusTabTitle = (
  tab: ProcessStatusFilterTab,
  entityLabel = "procesos",
): string => {
  if (tab === "completed") return `${capitalize(entityLabel)} finalizados`;
  if (tab === "inProgress") return `${capitalize(entityLabel)} en curso`;
  return `Todos los ${entityLabel}`;
};

const capitalize = (value: string): string =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

interface ProcessStatusFilterTabsProps {
  activeTab: ProcessStatusFilterTab;
  counts: Record<ProcessStatusFilterTab, number>;
  onChange: (tab: ProcessStatusFilterTab) => void;
}

/** Pestañas para filtrar procesos por estado agregado. */
function ProcessStatusFilterTabs({
  activeTab,
  counts,
  onChange,
}: ProcessStatusFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROCESS_STATUS_FILTER_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const count = counts[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              isActive
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-muted ring-1 ring-border hover:text-primary",
            )}
          >
            <Icon size={14} className="shrink-0 opacity-90" />
            <span>{tab.label}</span>
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-primary/10 text-primary",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Pestañas de filtro por estado con contadores. */
export default ProcessStatusFilterTabs;
