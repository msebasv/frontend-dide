import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  actions?: ReactNode;
  badge?: string;
}

function PageHeader({
  title,
  description,
  backTo,
  actions,
  badge,
}: PageHeaderProps) {
  return (
    <div className="mb-5 sm:mb-8">
      <div className="rounded-[1.25rem] border border-border bg-white px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            {backTo && (
              <Link
                to={backTo}
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted transition hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <IoArrowBack size={18} />
              </Link>
            )}
            <div className="min-w-0">
              {badge && (
                <span className="mb-2 inline-block rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {badge}
                </span>
              )}
              <h1 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&_a]:w-full sm:[&_a]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PageHeader;
