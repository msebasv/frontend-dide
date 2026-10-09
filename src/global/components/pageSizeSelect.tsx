/**
 * Cantidad de filas por página. La elige quien usa la tabla.
 */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSizeOption = 10;

const isPageSizeOption = (value: number): value is PageSizeOption =>
  (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);

interface PageSizeSelectProps {
  value: PageSizeOption;
  onChange: (size: PageSizeOption) => void;
  itemLabel?: string;
}

function PageSizeSelect({
  value,
  onChange,
  itemLabel = "registros",
}: PageSizeSelectProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="whitespace-nowrap">Mostrar</span>
      <select
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (isPageSizeOption(next)) onChange(next);
        }}
        aria-label={`Cantidad de ${itemLabel} por página`}
        className="rounded-full border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-primary outline-none focus:ring-2 focus:ring-secondary/30"
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}

export default PageSizeSelect;
