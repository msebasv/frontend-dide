/**
 * Tabla de seguimiento expandible: proceso → General / unidad → categorías con fase.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  IoChevronBack,
  IoChevronDownOutline,
  IoChevronForward,
  IoEyeOutline,
  IoPersonAddOutline,
  IoSearchOutline,
} from "react-icons/io5";

import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import { canAssignDideDesigner } from "../../global/constants/domainConstants";
import PageSizeSelect, {
  DEFAULT_PAGE_SIZE,
  type PageSizeOption,
} from "../../global/components/pageSizeSelect";
import CatalogFilterBar from "../../global/components/catalogFilterBar";
import {
  EMPTY_CATALOG_FILTER,
  isCatalogFilterActive,
  matchesCatalogFilter,
  type CatalogFilter,
} from "../../global/utils/catalogFilters";
import { useAuth } from "../../global/hooks/useAuth";
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

/** Cabecera fija (Entregable / Fase). */
const metaHead =
  "border-b border-r border-border bg-acacia-5 px-4 py-3 align-middle text-xs font-semibold uppercase tracking-wider text-muted";
/** Etiqueta de macrofase (fila superior). */
const groupHeadStart =
  "border-b border-l border-border bg-acacia-5 px-3 pb-1 pt-2.5 text-center text-[10px] font-semibold tracking-wide text-muted";
/** Roles bajo cada macrofase. */
const roleHead =
  "border-b border-border bg-acacia-5 px-3 pb-2.5 pt-1 text-xs font-semibold text-primary";
const roleHeadStart = `${roleHead} border-l border-border`;
/** Celdas de cuerpo. */
const metaCell = "border-r border-border-light px-4 py-3 align-middle";
const bodyCell = "px-3 py-3 align-middle";
const bodyCellStart = `${bodyCell} border-l border-border-light`;

const visiblePageNumbers = (current: number, total: number): number[] => {
  const count = Math.min(total, 5);
  let start = 1;
  if (total > 5) {
    if (current <= 3) start = 1;
    else if (current >= total - 2) start = total - 4;
    else start = current - 2;
  }
  return Array.from({ length: count }, (_, index) => start + index);
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
      "inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-medium",
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
          : `Unidad ${creditNumber}`,
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
  const { currentRole } = useAuth();
  const canAssignDesigner = canAssignDideDesigner(currentRole);
  const [search, setSearch] = useState("");
  const [catalogFilter, setCatalogFilter] =
    useState<CatalogFilter>(EMPTY_CATALOG_FILTER);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);
  const [expandedProcessIds, setExpandedProcessIds] = useState<string[]>([]);
  const [expandedCredits, setExpandedCredits] = useState<
    Record<string, number[]>
  >({});

  const filteredRows = useMemo(() => {
    const scoped = rows.filter((row) =>
      matchesCatalogFilter(
        {
          facultyName: row.facultyName,
          programName: row.programName,
          semester: row.semester,
          createdOn: row.createdOn,
        },
        catalogFilter,
      ),
    );
    const query = search.trim().toLowerCase();
    if (!query) return scoped;

    return scoped.filter((row) => {
      const haystack = [
        row.processName,
        row.courseName,
        row.facultyName,
        row.programName,
        row.authorLabel,
        row.validatorLabel,
        row.advisorLabel,
        row.designerLabel,
        row.phaseShort,
        ...row.deliverables.map((item) => item.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search, catalogFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / pageSize),
  );
  const page = Math.min(currentPage, totalPages);
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handlePageSize = (size: PageSizeOption) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rows, catalogFilter]);

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
            / unidades
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <CatalogFilterBar
            records={rows.map((row) => ({
              facultyName: row.facultyName,
              programName: row.programName,
              semester: row.semester,
              createdOn: row.createdOn,
            }))}
            value={catalogFilter}
            onChange={(next) => {
              setCatalogFilter(next);
              setCurrentPage(1);
            }}
          />
          <div className="relative w-full sm:w-72">
            <IoSearchOutline
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={16}
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar proceso, curso o entregable..."
              className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-3 text-sm text-primary outline-none focus:ring-2 focus:ring-secondary/30"
            />
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">
          {search.trim() || isCatalogFilterActive(catalogFilter)
            ? "No hay procesos que coincidan con los filtros."
            : emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-border-light">
          {pageRows.map((row) => {
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
                        {row.elapsedLabel ? ` · ${row.elapsedLabel}` : ""}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {canAssignDesigner && !row.isFinalized && (
                      <Link
                        to={`/virtualization-processes/${row.processId}/assign-designer`}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <IoPersonAddOutline size={14} />
                        {row.needsDesignerAssignment
                          ? "Asignar diseñador"
                          : "Cambiar diseñador"}
                      </Link>
                    )}
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
                        Este proceso no tiene entregables registrados.
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
                                <div className="table-scroll border-t border-border">
                                  <table className="min-w-full text-left text-sm">
                                    <thead>
                                      <tr>
                                        <th
                                          rowSpan={2}
                                          className={metaHead}
                                        >
                                          Entregable
                                        </th>
                                        <th
                                          rowSpan={2}
                                          className={metaHead}
                                        >
                                          Fase
                                        </th>
                                        {group.creditNumber === 0 && (
                                          <th
                                            colSpan={1}
                                            className={groupHeadStart}
                                          >
                                            Pre validación documental
                                          </th>
                                        )}
                                        <th
                                          colSpan={3}
                                          className={groupHeadStart}
                                        >
                                          Fase documental
                                        </th>
                                        <th
                                          colSpan={2}
                                          className={groupHeadStart}
                                        >
                                          Creación documental DIDE
                                        </th>
                                        <th
                                          colSpan={1}
                                          className={groupHeadStart}
                                        >
                                          Validación cargue en el aula
                                        </th>
                                      </tr>
                                      <tr>
                                        {group.creditNumber === 0 && (
                                          <th className={roleHeadStart}>
                                            Líder
                                          </th>
                                        )}
                                        <th className={roleHeadStart}>
                                          Autor
                                        </th>
                                        <th className={roleHead}>
                                          Validador Disciplinar
                                        </th>
                                        <th className={roleHead}>
                                          Asesor
                                        </th>
                                        <th className={roleHeadStart}>
                                          Diseñador DIDE
                                        </th>
                                        <th className={roleHead}>
                                          Asesor
                                        </th>
                                        <th className={roleHeadStart}>
                                          Líder
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light">
                                      {group.deliverables.map((item) => (
                                        <tr
                                          key={item.id}
                                          className="bg-white transition-colors hover:bg-acacia-5/60"
                                        >
                                          <td className={metaCell}>
                                            <p className="font-medium text-primary">
                                              {item.name}
                                            </p>
                                            <p className="mt-0.5 text-[11px] font-normal text-muted">
                                              {item.activityCount === 0
                                                ? "Sin historial"
                                                : `${item.activityCount} en historial`}
                                            </p>
                                          </td>
                                          <td className={metaCell}>
                                            <ProcessStatus
                                              status={item.phase}
                                              compact
                                            />
                                            {item.elapsedLabel ? (
                                              <p className="mt-1 text-[11px] font-normal text-muted">
                                                {item.elapsedLabel}
                                              </p>
                                            ) : null}
                                          </td>
                                          {group.creditNumber === 0 && (
                                            <td className={bodyCellStart}>
                                              <ProgressChip
                                                code={item.leaderPreStatus}
                                                label={
                                                  item.leaderPreStatusLabel
                                                }
                                              />
                                            </td>
                                          )}
                                          <td className={bodyCellStart}>
                                            <ProgressChip
                                              code={item.authorStatus}
                                              label={item.authorStatusLabel}
                                            />
                                          </td>
                                          <td className={bodyCell}>
                                            <ProgressChip
                                              code={item.validatorStatus}
                                              label={item.validatorStatusLabel}
                                            />
                                          </td>
                                          <td className={bodyCell}>
                                            <ProgressChip
                                              code={item.advisorStatus}
                                              label={item.advisorStatusLabel}
                                            />
                                          </td>
                                          <td className={bodyCellStart}>
                                            <ProgressChip
                                              code={item.designerStatus}
                                              label={item.designerStatusLabel}
                                            />
                                          </td>
                                          <td className={bodyCell}>
                                            <ProgressChip
                                              code={item.advisorAvStatus}
                                              label={item.advisorAvStatusLabel}
                                            />
                                          </td>
                                          <td className={bodyCellStart}>
                                            <ProgressChip
                                              code={item.leaderClassroomStatus}
                                              label={
                                                item.leaderClassroomStatusLabel
                                              }
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
                      <span>
                        <span className="font-semibold text-primary">
                          Diseñador DIDE:
                        </span>{" "}
                        {row.designerLabel}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filteredRows.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border bg-acacia-5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <PageSizeSelect
              value={pageSize}
              onChange={handlePageSize}
              itemLabel="procesos"
            />
            <span className="text-xs text-muted">
              <span className="sm:hidden">
                Página {page} de {totalPages} · {filteredRows.length} reg.
              </span>
              <span className="hidden sm:inline">
                Mostrando{" "}
                <span className="font-medium text-primary">
                  {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, filteredRows.length)}
                </span>{" "}
                de{" "}
                <span className="font-medium text-primary">
                  {filteredRows.length}
                </span>{" "}
                procesos
              </span>
            </span>
          </div>

          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setCurrentPage(page - 1)}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-primary transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:flex-none sm:py-1.5"
            >
              <IoChevronBack size={14} />
              <span className="sm:inline">Anterior</span>
            </button>

            <div className="hidden items-center gap-1 px-2 sm:flex">
              {visiblePageNumbers(page, totalPages).map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition",
                    page === pageNumber
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:bg-white hover:text-primary",
                  )}
                >
                  {pageNumber}
                </button>
              ))}
            </div>

            <span className="px-2 text-xs font-medium text-primary sm:hidden">
              {page}/{totalPages}
            </span>

            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setCurrentPage(page + 1)}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-primary transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:flex-none sm:py-1.5"
            >
              <span className="sm:inline">Siguiente</span>
              <IoChevronForward size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProcessTrackingBoard;
