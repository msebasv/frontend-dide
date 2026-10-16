/**
 * Insignia que muestra días hábiles transcurridos.
 */
import { formatElapsedDays } from "../utils/colombiaBusinessDays";

/** Insignia «N días transcurridos». `prefix` distingue entregable y proceso. */
export function ElapsedDaysBadge({
  days,
  prefix,
}: {
  days: number;
  prefix?: string;
}) {
  const label = formatElapsedDays(days);
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
      {prefix ? `${prefix}: ${label}` : label}
    </span>
  );
}
