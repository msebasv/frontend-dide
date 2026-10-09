import { formatElapsedDays } from "../utils/colombiaBusinessDays";

/** Insignia «N días transcurridos». */
export function ElapsedDaysBadge({ days }: { days: number }) {
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
      {formatElapsedDays(days)}
    </span>
  );
}
