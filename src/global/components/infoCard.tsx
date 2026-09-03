import { IoInformationCircleOutline } from "react-icons/io5";

interface InfoItem {
  label: string;
  value: string;
}

interface InfoCardProps {
  title: string;
  items: InfoItem[];
}

function InfoCard({ title, items }: InfoCardProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-b border-border bg-acacia-5 px-4 py-3 sm:px-5 sm:py-3.5">
        <IoInformationCircleOutline
          className="shrink-0 text-secondary"
          size={18}
        />
        <h3 className="text-sm font-bold text-primary">{title}</h3>
      </div>
      <dl className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-2xl bg-acacia-5/80 px-3 py-3 sm:px-4"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-primary [overflow-wrap:anywhere]">
              {item.value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default InfoCard;
