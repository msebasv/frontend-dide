import { IoCheckmarkCircle, IoChevronDownOutline } from "react-icons/io5";
import clsx from "clsx";

import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import {
  isCreditGroupApproved,
  materialBelongsToDeliverable,
  type ProcessDeliverableGroup,
} from "../services/deliverableService";
import type { CourseMaterial } from "../types/course.types";

export interface CourseDetailDeliverablesPanelProps {
  groups: ProcessDeliverableGroup[];
  materials: CourseMaterial[];
  deliverableCount: number;
  expandedCredits: number[];
  selectedDeliverableId: string;
  onToggleCreditGroup: (creditNumber: number) => void;
  onSelectDeliverable: (deliverableId: string) => void;
}

export function CourseDetailDeliverablesPanel({
  groups,
  materials,
  deliverableCount,
  expandedCredits,
  selectedDeliverableId,
  onToggleCreditGroup,
  onSelectDeliverable,
}: CourseDetailDeliverablesPanelProps) {
  return (
    <div className="flex h-[min(32rem,58dvh)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-4 lg:h-[min(36rem,65dvh)]">
      <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
        <h3 className="text-sm font-semibold text-primary">
          Entregables del proceso
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            {deliverableCount}
          </span>
        </h3>
        <p className="mt-1 text-xs text-muted">
          Expanda General o cada unidad para consultar sus entregables
          y la trazabilidad correspondiente.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
        {groups.map((group) => {
          const isExpanded = expandedCredits.includes(group.creditNumber);
          const groupApproved = isCreditGroupApproved(group);
          const groupActivityCount = group.items.reduce(
            (total, item) =>
              total +
              materials.filter((material) =>
                materialBelongsToDeliverable(material, item),
              ).length,
            0,
          );

          return (
            <div
              key={group.creditNumber}
              className="overflow-hidden rounded-xl border border-border"
            >
              <button
                type="button"
                onClick={() => onToggleCreditGroup(group.creditNumber)}
                className="flex w-full items-center gap-2 bg-acacia-5/60 px-3 py-2.5 text-left transition hover:bg-acacia-5"
                aria-expanded={isExpanded}
              >
                <IoChevronDownOutline
                  size={16}
                  className={clsx(
                    "shrink-0 text-primary transition-transform",
                    isExpanded ? "rotate-0" : "-rotate-90",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-primary">
                      {group.label}
                    </p>
                    {groupApproved && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200/80">
                        <IoCheckmarkCircle size={12} />
                        Aprobada
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted">
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "entregable" : "entregables"}
                    {groupActivityCount > 0
                      ? ` · ${groupActivityCount} en historial`
                      : ""}
                  </p>
                </div>
              </button>

              {isExpanded && (
                <ul className="space-y-1 border-t border-border p-2">
                  {group.items.map((item) => {
                    const isSelected = item.id === selectedDeliverableId;
                    const activityCount = materials.filter((material) =>
                      materialBelongsToDeliverable(material, item),
                    ).length;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelectDeliverable(item.id)}
                          className={clsx(
                            "w-full rounded-lg border px-3 py-2.5 text-left transition",
                            isSelected
                              ? "border-primary/30 bg-primary/5"
                              : "border-transparent hover:border-border hover:bg-acacia-5/80",
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
                              {item.name}
                            </p>
                            <span
                              className={clsx(
                                "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                                item.isRequired
                                  ? "bg-primary/10 text-primary"
                                  : "bg-gray-100 text-muted",
                              )}
                            >
                              {item.isRequired ? "Obligatorio" : "Opcional"}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <ProcessStatus status={item.stateLabel} />
                            <span className="text-[10px] text-muted">
                              {activityCount === 0
                                ? "Sin historial"
                                : `${activityCount} en historial`}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
