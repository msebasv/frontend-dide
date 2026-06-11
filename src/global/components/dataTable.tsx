import { type ReactNode, useMemo, useState } from "react";

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
}

function DataTable<T>({ columns, data, pageSize = 10 }: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / pageSize);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="px-6 py-3 font-semibold text-gray-700"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b hover:bg-gray-50">
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`px-6 py-4 ${column.className ?? ""}`}
                    >
                      {column.render
                        ? column.render(row)
                        : String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-gray-500"
                >
                  No hay registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t px-6 py-4">
        <span className="text-sm text-gray-600">
          Mostrando {(currentPage - 1) * pageSize + 1}
          {" - "}
          {Math.min(currentPage * pageSize, data.length)}
          {" de "}
          {data.length}
        </span>

        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="rounded border px-3 py-2 disabled:opacity-50"
          >
            Anterior
          </button>

          <span className="flex items-center px-2">
            {currentPage} / {totalPages || 1}
          </span>

          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="rounded border px-3 py-2 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
