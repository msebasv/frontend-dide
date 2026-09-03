import { type ReactNode } from "react";
import { useSidebar } from "../context/sidebarContext";
import { NavLink } from "react-router-dom";
import clsx from "clsx";

interface SidebarItemProps {
  icon: ReactNode;
  text: string;
  path: string;
}

const SidebarItem = ({ icon, text, path }: SidebarItemProps) => {
  const { isOpen, closeMobile } = useSidebar();

  return (
    <NavLink
      to={path}
      onClick={() => closeMobile?.()}
      title={!isOpen ? text : undefined}
      className={({ isActive }) =>
        clsx(
          "sidebar-item group relative flex min-h-11 items-center rounded-full text-sm outline-none",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isOpen ? "gap-3 px-2.5" : "justify-center px-0",
          isActive
            ? "bg-primary text-white shadow-[0_8px_18px_-10px_rgba(0,64,64,0.55)]"
            : "text-primary/65 hover:bg-acacia-10 hover:text-primary",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={clsx(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isActive
                ? "bg-secondary/25 text-secondary"
                : "bg-transparent text-current group-hover:bg-white/60",
            )}
          >
            <span
              className={clsx(
                "inline-flex transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "group-hover:scale-110",
                isActive && "scale-105",
              )}
            >
              {icon}
            </span>
          </span>

          <span
            className={clsx(
              "overflow-hidden whitespace-nowrap font-semibold tracking-tight",
              "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isOpen
                ? "max-w-[12rem] translate-x-0 opacity-100"
                : "max-w-0 -translate-x-1 opacity-0",
            )}
          >
            {text}
          </span>

          <span
            className={clsx(
              "pointer-events-none absolute left-[calc(100%+0.65rem)] z-50 hidden",
              "whitespace-nowrap rounded-full border border-border bg-surface px-3 py-2",
              "text-xs font-semibold text-primary shadow-[var(--shadow-card)]",
              "opacity-0 translate-x-1 transition-all duration-200 ease-out",
              "group-hover:translate-x-0 group-hover:opacity-100 md:block",
              isOpen && "!hidden",
            )}
          >
            {text}
            <span className="absolute top-1/2 left-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l border-border bg-surface" />
          </span>
        </>
      )}
    </NavLink>
  );
};

export default SidebarItem;
