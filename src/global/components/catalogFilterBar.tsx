/**
 * Botón que abre facultad, programa, año, semestre y fecha de creación.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { IoFilterOutline, IoOptionsOutline } from "react-icons/io5";

import Button from "./button";
import Modal from "./modal";
import {
  catalogFacultyOptions,
  catalogPeriodOptions,
  catalogProgramOptions,
  EMPTY_CATALOG_FILTER,
  type CatalogFilter,
  type CatalogRecord,
} from "../utils/catalogFilters";

interface CatalogFilterBarProps {
  records: CatalogRecord[];
  value: CatalogFilter;
  onChange: (next: CatalogFilter) => void;
}

const selectClassName =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-primary outline-none focus:border-secondary/40 focus:ring-2 focus:ring-secondary/20";

const optionLabel = (value: string, emptyLabel: string) =>
  value.trim() || emptyLabel;

const activeFilterCount = (filter: CatalogFilter): number =>
  Object.values(filter).filter((item) => item.trim() !== "").length;

const getSemesterYear = (semester: string): string => semester.slice(0, 4);

function FilterSelect({
  id,
  label,
  value,
  options,
  emptyOptionLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  emptyOptionLabel: string;
  onChange: (next: string) => void;
}) {
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option || emptyOptionLabel} value={option}>
            {optionLabel(option, emptyOptionLabel)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CatalogFilterBar({ records, value, onChange }: CatalogFilterBarProps) {
  const fieldId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilter>(value);
  const activeCount = activeFilterCount(value);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(value);
  }, [isOpen, value]);

  const faculties = useMemo(() => catalogFacultyOptions(records), [records]);
  const programs = useMemo(
    () => catalogProgramOptions(records, draft.facultyName),
    [records, draft.facultyName],
  );
  const periods = useMemo(
    () => catalogPeriodOptions(records, draft),
    [records, draft],
  );

  const applyFilters = () => {
    onChange(draft);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant={activeCount > 0 ? "primary" : "secondary"}
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <IoOptionsOutline size={16} />
        Filtros
        {activeCount > 0 ? (
          <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/20 px-1.5 text-[11px] font-bold">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Filtros"
        icon={<IoFilterOutline size={18} />}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FilterSelect
              id={`${fieldId}-faculty`}
              label="Facultad"
              value={draft.facultyName}
              options={faculties}
              emptyOptionLabel="Sin facultad"
              onChange={(facultyName) =>
                setDraft((current) => ({
                  ...current,
                  facultyName,
                  programName: "",
                }))
              }
            />
            <FilterSelect
              id={`${fieldId}-program`}
              label="Programa"
              value={draft.programName}
              options={programs}
              emptyOptionLabel="Sin programa"
              onChange={(programName) =>
                setDraft((current) => ({ ...current, programName }))
              }
            />
            <FilterSelect
              id={`${fieldId}-year`}
              label="Año"
              value={draft.year}
              options={periods.years}
              emptyOptionLabel="Sin año"
              onChange={(year) =>
                setDraft((current) => ({
                  ...current,
                  year,
                  semester:
                    !year || getSemesterYear(current.semester) === year
                      ? current.semester
                      : "",
                }))
              }
            />
            <FilterSelect
              id={`${fieldId}-semester`}
              label="Semestre"
              value={draft.semester}
              options={periods.semesters}
              emptyOptionLabel="Sin semestre"
              onChange={(semester) =>
                setDraft((current) => ({ ...current, semester }))
              }
            />
            <label htmlFor={`${fieldId}-created-from`} className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                Creación desde
              </span>
              <input
                id={`${fieldId}-created-from`}
                type="date"
                value={draft.createdFrom}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    createdFrom: event.target.value,
                  }))
                }
                className={selectClassName}
              />
            </label>
            <label htmlFor={`${fieldId}-created-to`} className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                Creación hasta
              </span>
              <input
                id={`${fieldId}-created-to`}
                type="date"
                value={draft.createdTo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    createdTo: event.target.value,
                  }))
                }
                className={selectClassName}
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(EMPTY_CATALOG_FILTER)}
            >
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

export default CatalogFilterBar;
