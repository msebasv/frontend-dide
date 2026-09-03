/**
 * Barra compacta de filtros + modal con periodo y dimensiones.
 * Mantiene la página limpia y deja los controles en un solo lugar.
 */
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  IoCalendarOutline,
  IoCloseOutline,
  IoFilterOutline,
  IoOptionsOutline,
} from "react-icons/io5";

import Button from "../../global/components/button";
import Modal from "../../global/components/modal";
import {
  ALL_PERIOD_FILTER,
  type PeriodFilter,
  type PeriodFilterType,
} from "../../global/utils/semesterUtils";
import {
  ALL_DIMENSION_VALUE,
  EMPTY_DIMENSION_FILTERS,
  type StatisticsDimensionFilters,
  type StatisticsFilterOptions,
  type StatisticsScopeMode,
} from "../types/statistics.types";

interface StatisticsFiltersBarProps {
  periodFilter: PeriodFilter;
  years: string[];
  semesters: string[];
  onPeriodChange: (type: PeriodFilterType, value?: string) => void;
  dimensionFilters: StatisticsDimensionFilters;
  options: StatisticsFilterOptions;
  getOptions: (dimensions: StatisticsDimensionFilters) => StatisticsFilterOptions;
  onDimensionsChange: (next: StatisticsDimensionFilters) => void;
  onClearDimensions: () => void;
  periodSubtitle: string;
  /** Oculta filtros de responsable cuando el alcance ya está fijado por rol. */
  scopeMode?: StatisticsScopeMode;
  scopeLabel?: string;
}

interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

const selectClassName =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-primary transition focus:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 disabled:opacity-50";

const PERIOD_OPTIONS: { type: PeriodFilterType; label: string }[] = [
  { type: "all", label: "Todos" },
  { type: "year", label: "Por año" },
  { type: "semester", label: "Por semestre" },
];

function countActiveFilters(
  period: PeriodFilter,
  dimensions: StatisticsDimensionFilters,
): number {
  let count = period.type !== "all" && period.value ? 1 : 0;
  if (dimensions.facultyName !== ALL_DIMENSION_VALUE) count += 1;
  if (dimensions.programName !== ALL_DIMENSION_VALUE) count += 1;
  if (dimensions.advisorEmail !== ALL_DIMENSION_VALUE) count += 1;
  if (dimensions.leaderEmail !== ALL_DIMENSION_VALUE) count += 1;
  count += dimensions.statuses.length;
  return count;
}

function findLabel(
  options: { value: string; label: string }[],
  value: string,
): string {
  return options.find((item) => item.value === value)?.label ?? value;
}

function StatisticsFiltersBar({
  periodFilter,
  years,
  semesters,
  onPeriodChange,
  dimensionFilters,
  options,
  getOptions,
  onDimensionsChange,
  onClearDimensions,
  periodSubtitle,
  scopeMode = "global",
  scopeLabel,
}: StatisticsFiltersBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState(periodFilter);
  const [draftDimensions, setDraftDimensions] = useState(dimensionFilters);

  useEffect(() => {
    if (!isOpen) return;
    setDraftPeriod(periodFilter);
    setDraftDimensions(dimensionFilters);
  }, [isOpen, periodFilter, dimensionFilters]);

  const draftOptions = useMemo(
    () => getOptions(draftDimensions),
    [getOptions, draftDimensions],
  );

  const activeCount = countActiveFilters(periodFilter, dimensionFilters);

  const chips = useMemo<FilterChip[]>(() => {
    const items: FilterChip[] = [];

    if (periodFilter.type !== "all" && periodFilter.value) {
      items.push({
        id: "period",
        label: periodSubtitle,
        onRemove: () => onPeriodChange("all"),
      });
    }

    if (dimensionFilters.facultyName !== ALL_DIMENSION_VALUE) {
      items.push({
        id: "faculty",
        label: findLabel(options.faculties, dimensionFilters.facultyName),
        onRemove: () =>
          onDimensionsChange({
            ...dimensionFilters,
            facultyName: ALL_DIMENSION_VALUE,
            programName: ALL_DIMENSION_VALUE,
          }),
      });
    }

    if (dimensionFilters.programName !== ALL_DIMENSION_VALUE) {
      items.push({
        id: "program",
        label: findLabel(options.programs, dimensionFilters.programName),
        onRemove: () =>
          onDimensionsChange({
            ...dimensionFilters,
            programName: ALL_DIMENSION_VALUE,
          }),
      });
    }

    if (dimensionFilters.advisorEmail !== ALL_DIMENSION_VALUE) {
      items.push({
        id: "advisor",
        label: `Asesor: ${findLabel(options.advisors, dimensionFilters.advisorEmail)}`,
        onRemove: () =>
          onDimensionsChange({
            ...dimensionFilters,
            advisorEmail: ALL_DIMENSION_VALUE,
          }),
      });
    }

    if (dimensionFilters.leaderEmail !== ALL_DIMENSION_VALUE) {
      items.push({
        id: "leader",
        label: `Líder: ${findLabel(options.leaders, dimensionFilters.leaderEmail)}`,
        onRemove: () =>
          onDimensionsChange({
            ...dimensionFilters,
            leaderEmail: ALL_DIMENSION_VALUE,
          }),
      });
    }

    for (const status of dimensionFilters.statuses) {
      items.push({
        id: `status-${status}`,
        label: findLabel(options.statuses, status),
        onRemove: () =>
          onDimensionsChange({
            ...dimensionFilters,
            statuses: dimensionFilters.statuses.filter((item) => item !== status),
          }),
      });
    }

    return items;
  }, [
    periodFilter,
    periodSubtitle,
    dimensionFilters,
    options,
    onPeriodChange,
    onDimensionsChange,
  ]);

  const draftValueOptions =
    draftPeriod.type === "year"
      ? years
      : draftPeriod.type === "semester"
        ? semesters
        : [];

  const handleDraftPeriodType = (type: PeriodFilterType) => {
    if (type === "all") {
      setDraftPeriod(ALL_PERIOD_FILTER);
      return;
    }

    const nextOptions = type === "year" ? years : semesters;
    const nextValue =
      draftPeriod.type === type && draftPeriod.value
        ? draftPeriod.value
        : (nextOptions[0] ?? "");

    setDraftPeriod({ type, value: nextValue });
  };

  const updateDraftDimensions = (
    patch: Partial<StatisticsDimensionFilters>,
  ) => {
    setDraftDimensions((current) => ({ ...current, ...patch }));
  };

  const toggleDraftStatus = (status: string) => {
    setDraftDimensions((current) => {
      const exists = current.statuses.includes(status);
      return {
        ...current,
        statuses: exists
          ? current.statuses.filter((item) => item !== status)
          : [...current.statuses, status],
      };
    });
  };

  const applyFilters = () => {
    onPeriodChange(draftPeriod.type, draftPeriod.value);
    onDimensionsChange(draftDimensions);
    setIsOpen(false);
  };

  const clearAll = () => {
    onPeriodChange("all");
    onClearDimensions();
    setDraftPeriod(ALL_PERIOD_FILTER);
    setDraftDimensions(EMPTY_DIMENSION_FILTERS);
    setIsOpen(false);
  };

  const clearDraft = () => {
    setDraftPeriod(ALL_PERIOD_FILTER);
    setDraftDimensions(EMPTY_DIMENSION_FILTERS);
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">Vista de análisis</p>
            <p className="truncate text-xs text-muted">
              {scopeLabel
                ? scopeLabel
                : activeCount === 0
                  ? "Sin filtros · se muestran todos los procesos"
                  : `${activeCount} filtro${activeCount === 1 ? "" : "s"} activo${activeCount === 1 ? "" : "s"}`}
              {scopeLabel && activeCount > 0
                ? ` · ${activeCount} filtro${activeCount === 1 ? "" : "s"} adicional${activeCount === 1 ? "" : "es"}`
                : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <IoCloseOutline size={16} />
                Limpiar
              </Button>
            )}
            <Button
              variant={activeCount > 0 ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIsOpen(true)}
            >
              <IoOptionsOutline size={16} />
              Filtros
              {activeCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/20 px-1.5 text-[11px] font-bold">
                  {activeCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border bg-gray-50/70 px-4 py-3">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onRemove}
                className="group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm transition hover:border-primary/25 hover:bg-primary/5"
                title="Quitar filtro"
              >
                <span className="truncate">{chip.label}</span>
                <IoCloseOutline
                  size={14}
                  className="shrink-0 text-muted transition group-hover:text-primary"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Filtros de estadísticas"
        icon={<IoFilterOutline size={18} />}
        size="xl"
      >
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <IoCalendarOutline size={16} className="text-secondary" />
              <h3 className="text-sm font-semibold text-primary">
                Periodo académico
              </h3>
            </div>

            <div className="inline-flex w-full gap-1 rounded-xl border border-border bg-gray-50 p-1 sm:w-auto">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => handleDraftPeriodType(option.type)}
                  className={clsx(
                    "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition sm:flex-none",
                    draftPeriod.type === option.type
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted hover:text-primary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {draftPeriod.type !== "all" && (
              <select
                value={draftPeriod.value}
                onChange={(event) =>
                  setDraftPeriod({
                    type: draftPeriod.type,
                    value: event.target.value,
                  })
                }
                disabled={draftValueOptions.length === 0}
                className={selectClassName}
              >
                {draftValueOptions.length === 0 ? (
                  <option value="">Sin datos</option>
                ) : (
                  draftValueOptions.map((option) => (
                    <option key={option} value={option}>
                      {draftPeriod.type === "year" ? `Año ${option}` : option}
                    </option>
                  ))
                )}
              </select>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Organización</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Facultad</span>
                <select
                  value={draftDimensions.facultyName}
                  onChange={(event) =>
                    updateDraftDimensions({
                      facultyName: event.target.value,
                      programName: ALL_DIMENSION_VALUE,
                    })
                  }
                  className={selectClassName}
                >
                  <option value={ALL_DIMENSION_VALUE}>Todas</option>
                  {draftOptions.faculties.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Programa</span>
                <select
                  value={draftDimensions.programName}
                  onChange={(event) =>
                    updateDraftDimensions({ programName: event.target.value })
                  }
                  className={selectClassName}
                >
                  <option value={ALL_DIMENSION_VALUE}>Todos</option>
                  {draftOptions.programs.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {scopeMode === "global" && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Responsables</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">
                  Asesor pedagógico
                </span>
                <select
                  value={draftDimensions.advisorEmail}
                  onChange={(event) =>
                    updateDraftDimensions({ advisorEmail: event.target.value })
                  }
                  className={selectClassName}
                >
                  <option value={ALL_DIMENSION_VALUE}>Todos</option>
                  {draftOptions.advisors.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">
                  Líder de virtualización
                </span>
                <select
                  value={draftDimensions.leaderEmail}
                  onChange={(event) =>
                    updateDraftDimensions({ leaderEmail: event.target.value })
                  }
                  className={selectClassName}
                >
                  <option value={ALL_DIMENSION_VALUE}>Todos</option>
                  {draftOptions.leaders.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          )}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-primary">Estados</h3>
              <p className="mt-0.5 text-xs text-muted">
                Sin selección = todos. Puedes marcar varios.
              </p>
            </div>

            {draftOptions.statuses.length === 0 ? (
              <p className="text-xs text-muted">Sin estados disponibles</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {draftOptions.statuses.map((option) => {
                  const selected = draftDimensions.statuses.includes(
                    option.value,
                  );
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDraftStatus(option.value)}
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        selected
                          ? "bg-primary text-white shadow-sm"
                          : "border border-border bg-white text-muted hover:border-primary/30 hover:text-primary",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button variant="ghost" size="sm" onClick={clearDraft}>
              Restablecer
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={applyFilters}>
                Aplicar filtros
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default StatisticsFiltersBar;
