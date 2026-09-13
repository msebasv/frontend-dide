/**
 * Tabla de seguimiento expandible: proceso → General / crédito → categorías con fase.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  IoChevronDownOutline,
  IoEyeOutline,
  IoSearchOutline,
} from "react-icons/io5";

import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import type {
  ActorProgressCode,
  DeliverableTrackingItem,
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

const groupDeliverables = (items: DeliverableTrackingItem[]) => {
  const map = new Map<number, DeliverableTrackingItem[]>();
  for (const item of items) {
    const bucket = map.get(item.creditNumber) ?? [];
    bucket.push(item);
    map.set(item.creditNumber, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([creditNumber, deliverables]) => ({
      creditNumber,
      label:
        creditNumber === 0
          ? "General"
          : `Crédito / Unidad ${creditNumber}`,
      deliverables,
    }));
};

interface ProcessTrackingBoardProps {
  rows: ProcessTrackingRow[];
  emptyMessage?: string;
}

function ProcessTrackingBoard({
  rows,
  emptyMessage = "No hay procesos registrados para mostrar.",
}: ProcessTrackingBoardProps) {
  const [search, setSearch] = useState("");
  const [expandedProcessIds, setExpandedProcessIds] = useState<string[]>([]);
  const [expandedCredits, setExpandedCredits] = useState<
    Record<string, number[]>
  >({});

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.processName,
        row.courseName,
        row.facultyName,
        row.authorLabel,
        row.validatorLabel,
        row.advisorLabel,
        row.phaseShort,
        ...row.deliverables.map((item) => item.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search]);

  const toggleProcess = (processId: string) => {
    setExpandedProcessIds((current) =>
      current.includes(processId)
        ? current.filter((id) => id !== processId)
        : [...current, processId],
    );
  };

  const toggleCredit = (processId: string, creditNumber: number) => {
    setExpandedCredits((current) => {
      const open = current[processId] ?? [];
      const next = open.includes(creditNumber)
        ? open.filter((value) => value !== creditNumber)
        : [...open, creditNumber];
      return { ...current, [processId]: next };
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            Avance por proceso
          </h3>
          <p className="text-xs text-muted">
            {filteredRows.length} proceso
            {filteredRows.length === 1 ? "" : "s"} · despliega para ver General
            / créditos
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <IoSearchOutline
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            size={16}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proceso, curso o entregable..."
            className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-3 text-sm text-primary outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-border-light">
          {filteredRows.map((row) => {
            const isExpanded = expandedProcessIds.includes(row.processId);
            const creditGroups = groupDeliverables(row.deliverables);
            const openCredits = expandedCredits[row.processId] ?? [];

            return (
              <li key={row.processId}>
                <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleProcess(row.processId)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    aria-expanded={isExpanded}
                  >
                    <IoChevronDownOutline
                      size={16}
                      className={clsx(
                        "mt-1 shrink-0 text-primary transition-transform",
                        isExpanded ? "rotate-0" : "-rotate-90",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-primary">
                        {row.processName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {row.courseName} · {row.facultyName}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {row.deliverables.length} entregable
                        {row.deliverables.length === 1 ? "" : "s"}
                        {" · "}
                        Actualizado {formatDateTime(row.modifiedOn)}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Link
                      to={row.detailPath}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-acacia-5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <IoEyeOutline size={14} />
                      Ver detalle
                    </Link>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-acacia-5/40 px-4 py-3 sm:px-5">
                    {creditGroups.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border bg-white px-3 py-6 text-center text-sm text-muted">
                        Este proceso aún no tiene entregables.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {creditGroups.map((group) => {
                          const creditOpen = openCredits.includes(
                            group.creditNumber,
                          );
                          return (
                            <div
                              key={`${row.processId}-${group.creditNumber}`}
                              className="overflow-hidden rounded-xl border border-border bg-white"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  toggleCredit(
                                    row.processId,
                                    group.creditNumber,
                                  )
                                }
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-acacia-5/80"
                                aria-expanded={creditOpen}
                              >
                                <IoChevronDownOutline
                                  size={14}
                                  className={clsx(
                                    "shrink-0 text-primary transition-transform",
                                    creditOpen ? "rotate-0" : "-rotate-90",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-primary">
                                    {group.label}
                                  </p>
                                  <p className="text-[11px] text-muted">
                                    {group.deliverables.length} entregable
                                    {group.deliverables.length === 1
                                      ? ""
                                      : "s"}
                                  </p>
                                </div>
                              </button>

                              {creditOpen && (
                                <div className="overflow-x-auto border-t border-border">
                                  <table className="min-w-full text-left text-sm">
                                    <thead className="bg-acacia-5/70 text-[11px] uppercase tracking-wide text-muted">
                                      <tr>
                                        <th className="px-3 py-2 font-semibold">
                                          Entregable
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Fase
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Autor
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Validador Disciplinar
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Asesor
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light">
                                      {group.deliverables.map((item) => (
                                        <tr key={item.id}>
                                          <td className="px-3 py-2.5">
                                            <p className="font-medium text-primary">
                                              {item.name}
                                            </p>
                                            <p className="text-[11px] text-muted">
                                              {item.activityCount} actividad
                                              {item.activityCount === 1
                                                ? ""
                                                : "es"}
                                            </p>
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <ProcessStatus
                                              status={item.phase}
                                            />
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <ProgressChip
                                              code={item.authorStatus}
                                              label={item.authorStatusLabel}
                                            />
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <ProgressChip
                                              code={item.validatorStatus}
                                              label={item.validatorStatusLabel}
                                            />
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <ProgressChip
                                              code={item.advisorStatus}
                                              label={item.advisorStatusLabel}
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-3 rounded-lg border border-border bg-white px-3 py-2.5 text-xs text-muted">
                      <span>
                        <span className="font-semibold text-primary">
                          Autor:
                        </span>{" "}
                        {row.authorLabel}
                      </span>
                      <span>
                        <span className="font-semibold text-primary">
                          Validador Disciplinar:
                        </span>{" "}
                        {row.validatorLabel}
                      </span>
                      <span>
                        <span className="font-semibold text-primary">
                          Asesor:
                        </span>{" "}
                        {row.advisorLabel}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ProcessTrackingBoard;
