import clsx from "clsx";
import { FaChevronLeft, FaTimes } from "react-icons/fa";

import logoUnbosque from "../../assets/brand/logounbosque.png?inline";
import logoDide from "../../assets/brand/logodide.png?inline";

interface SidebarProps {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showCollapse?: boolean;
  onCloseMobile?: () => void;
}

const Sidebar = ({
  children,
  isOpen,
  setIsOpen,
  showCollapse = true,
  onCloseMobile,
}: SidebarProps) => {
  return (
    <div className="sidebar-shell relative flex h-full min-h-0 flex-col overflow-visible bg-background">
      <div className="relative flex shrink-0 items-center justify-between gap-2 px-3 py-5 md:px-4 md:py-6">
        <div
          className={clsx(
            "flex min-w-0 items-center",
            isOpen ? "flex-1 justify-center px-1" : "w-full justify-center",
          )}
        >
          <img
            src={logoUnbosque}
            alt="Universidad El Bosque"
            width={280}
            height={83}
            decoding="async"
            className={clsx(
              "object-contain transition-all duration-300",
              isOpen
                ? "h-[3.35rem] w-auto max-w-[15rem] sm:h-14"
                : "h-10 w-10 object-left",
            )}
          />
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="flex h-9 w-9 items-center justify-center rounded-full text-primary/50 transition duration-200 hover:bg-acacia-10 hover:text-primary active:scale-95 md:hidden"
            aria-label="Cerrar menú"
          >
            <FaTimes size={13} />
          </button>
        )}

        {showCollapse && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute top-7 right-0 z-50 hidden h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface p-0 leading-none text-primary shadow-[var(--shadow-card)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:border-secondary hover:bg-secondary hover:text-white active:scale-95 md:flex"
            aria-label={isOpen ? "Colapsar menú" : "Expandir menú"}
          >
            <FaChevronLeft
              size={12}
              className={clsx(
                "block shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                !isOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        )}
      </div>

      <div className="mx-4 h-px bg-border" />

      <div className="relative flex min-h-0 flex-1 flex-col px-3 pt-4">
        <p
          className={clsx(
            "mb-2 overflow-hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted transition-all duration-300",
            isOpen ? "max-h-6 opacity-100" : "mb-0 max-h-0 opacity-0",
          )}
        >
          Navegación
        </p>

        <nav className="sidebar-nav min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-visible pb-3">
          {children}
        </nav>
      </div>

      <div className="relative shrink-0 border-t border-border px-3 py-5 md:px-4">
        <div
          className={clsx(
            "flex items-center",
            isOpen ? "justify-center" : "justify-center",
          )}
        >
          <img
            src={logoDide}
            alt="DiDE · División de Innovación Digital en Educación"
            width={280}
            height={42}
            decoding="async"
            className={clsx(
              "object-contain transition-all duration-300",
              isOpen ? "h-11 w-auto max-w-[14.5rem]" : "h-8 w-8 object-left",
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
