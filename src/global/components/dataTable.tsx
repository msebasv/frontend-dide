/**
 * Tabla de datos reutilizable con búsqueda, paginación y filas clicables.
 *
 * Desktop: tabla clásica.
 * Móvil: lista de cards (evita scroll horizontal).
 *
 * getRowLink: navegación al hacer clic en la fila (usado en historial).
 * onRowClick: alternativa imperativa; los ActionButton internos usan stopPropagation.
 */
import { type ReactNode, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoSearchOutline, IoChevronBack, IoChevronForward } from "react-icons/io5";
import clsx from "clsx";

export interface Column<T> {
  key: keyof T;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  title?: string;
  subtitle?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  emptyMessage?: string;
  getRowLink?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
}

function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  title,
  subtitle,
  searchable = true,
  searchPlaceholder = "Buscar...",
  searchKeys,
  emptyMessage = "No se encontraron registros",
  getRowLink,
  onRowClick,
}: DataTableProps<T>) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;

    const query = search.toLowerCase();
    const keys = searchKeys ?? columns.map((c) => c.key);

    return data.filter((row) =>
      keys.some((key) =>
        String(row[key] ?? "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [data, search, searchKeys, columns]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const activateRow = (row: T) => {
    if (onRowClick) {
      onRowClick(row);
      return;
    }

    const rowLink = getRowLink?.(row);
    if (rowLink) navigate(rowLink);
  };

  const renderCell = (row: T, column: Column<T>, rowLink?: string) => {
    if (column.render) return column.render(row);

    const value = String(row[column.key] ?? "");
    if (rowLink && column.key === columns[0]?.key) {
      return (
        <Link
          to={rowLink}
          className="font-medium text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {value}
        </Link>
      );
    }

    return value;
  };

  const emptyState = (
    <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-acacia-5">
        <IoSearchOutline className="text-muted" size={20} />
      </div>
      <p className="text-sm font-medium text-gray-600">{emptyMessage}</p>
      {search && (
        <p className="text-xs text-muted">
          Intenta con otro término de búsqueda
        </p>
      )}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-[var(--shadow-card)]">
      {(title || searchable) && (
        <div className="flex flex-col gap-3 border-b border-border bg-acacia-5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-primary">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
            )}
          </div>
          {searchable && (
            <div className="relative w-full sm:w-72">
              <IoSearchOutline
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
                size={16}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-full border border-border bg-white py-2.5 pl-4 pr-10 text-base text-primary placeholder:text-muted shadow-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:py-2 sm:text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Móvil: cards */}
      <div className="md:hidden">
        {paginatedData.length > 0 ? (
          <ul className="divide-y divide-border-light">
            {paginatedData.map((row, rowIndex) => {
              const rowLink = getRowLink?.(row);
              const isClickable = Boolean(rowLink || onRowClick);
              const [primary, ...rest] = columns;

              return (
                <li key={rowIndex}>
                  <div
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={isClickable ? () => activateRow(row) : undefined}
                    onKeyDown={
                      isClickable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              activateRow(row);
                            }
                          }
                        : undefined
                    }
                    className={clsx(
                      "space-y-2.5 px-3 py-3.5 transition-colors",
                      isClickable &&
                        "cursor-pointer active:bg-acacia-5 hover:bg-acacia-5/80",
                    )}
                  >
                    {primary && (
                      <div className="min-w-0 text-sm font-semibold text-primary [overflow-wrap:anywhere]">
                        {renderCell(row, primary, rowLink)}
                      </div>
                    )}
                    {rest.length > 0 && (
                      <dl className="grid gap-2">
                        {rest.map((column) => (
                          <div
                            key={String(column.key)}
                            className="flex min-w-0 items-start justify-between gap-3"
                          >
                            <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">
                              {column.header}
                            </dt>
                            <dd
                              className={clsx(
                                "min-w-0 text-right text-sm text-gray-700 [overflow-wrap:anywhere]",
                                column.className,
                              )}
                              onClick={(event) => {
                                // Permite interactuar con botones/acciones sin navegar.
                                if (
                                  (event.target as HTMLElement).closest(
                                    "button, a, [role='button']",
                                  )
                                ) {
                                  event.stopPropagation();
                                }
                              }}
                            >
                              {renderCell(row, column, rowLink)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          emptyState
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-acacia-5">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted sm:px-5 sm:py-3.5"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border-light">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => {
                const rowLink = getRowLink?.(row);
                const isClickable = Boolean(rowLink || onRowClick);

                return (
                  <tr
                    key={rowIndex}
                    className={clsx(
                      "transition-colors duration-150",
                      isClickable &&
                        "cursor-pointer hover:bg-acacia-5 focus-within:bg-acacia-5/80",
                      !isClickable && "hover:bg-acacia-5/70",
                    )}
                    onClick={isClickable ? () => activateRow(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={clsx(
                          "px-3 py-3 text-sm text-gray-700 sm:px-5 sm:py-4",
                          column.className,
                        )}
                      >
                        {renderCell(row, column, rowLink)}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length}>{emptyState}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredData.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border bg-acacia-5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
          <span className="text-xs text-muted">
            <span className="sm:hidden">
              Página {currentPage} de {Math.max(totalPages, 1)} ·{" "}
              {filteredData.length} reg.
            </span>
            <span className="hidden sm:inline">
              Mostrando{" "}
              <span className="font-medium text-primary">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredData.length)}
              </span>{" "}
              de{" "}
              <span className="font-medium text-primary">
                {filteredData.length}
              </span>{" "}
              registros
            </span>
          </span>

          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-primary transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:flex-none sm:py-1.5"
            >
              <IoChevronBack size={14} />
              <span className="sm:inline">Anterior</span>
            </button>

            <div className="hidden items-center gap-1 px-2 sm:flex">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }

                return (
                  <button
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={clsx(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition",
                      currentPage === page
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:bg-white hover:text-primary",
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <span className="px-2 text-xs font-medium text-primary sm:hidden">
              {currentPage}/{Math.max(totalPages, 1)}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => p + 1)}
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

export default DataTable;
