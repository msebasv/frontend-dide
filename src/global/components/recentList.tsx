import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { IoChevronForward } from "react-icons/io5";

export interface RecentItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  link: string;
  icon?: ReactNode;
}

interface RecentListProps {
  title: string;
  items: RecentItem[];
  emptyMessage?: string;
  viewAllLink?: string;
  viewAllLabel?: string;
}

function RecentList({
  title,
  items,
  emptyMessage = "No hay elementos recientes",
  viewAllLink,
  viewAllLabel = "Ver todos",
}: RecentListProps) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-acacia-5 px-4 py-3.5 sm:px-5 sm:py-4">
        <h3 className="text-sm font-bold text-primary">{title}</h3>
        {viewAllLink && (
          <Link
            to={viewAllLink}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-primary-light"
          >
            {viewAllLabel}
            <IoChevronForward size={12} />
          </Link>
        )}
      </div>

      {items.length > 0 ? (
        <ul className="divide-y divide-border-light">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.link}
                className="group flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-acacia-10/60 focus-visible:bg-acacia-10 focus-visible:outline-none sm:items-center sm:px-5"
              >
                {item.icon && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acacia-10 text-primary transition-colors group-hover:bg-secondary group-hover:text-white">
                    {item.icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-muted">{item.subtitle}</p>
                  {item.badge && (
                    <span
                      className="mt-1.5 inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:hidden"
                      style={{
                        backgroundColor: `${item.badgeColor ?? "#004040"}18`,
                        color: item.badgeColor ?? "#004040",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.badge && (
                  <span
                    className="hidden max-w-[9rem] shrink-0 truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:inline-block"
                    style={{
                      backgroundColor: `${item.badgeColor ?? "#004040"}18`,
                      color: item.badgeColor ?? "#004040",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                <IoChevronForward
                  className="mt-1 shrink-0 text-border transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-secondary sm:mt-0"
                  size={14}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted">{emptyMessage}</p>
      )}
    </div>
  );
}

export default RecentList;
