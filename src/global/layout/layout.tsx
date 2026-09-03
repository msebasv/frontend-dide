/**
 * Layout principal de la aplicación.
 *
 * Desktop: sidebar colapsable.
 * Móvil: drawer overlay con menú hamburguesa.
 *
 * El shell usa altura fija (h-dvh) y solo el main hace scroll,
 * para que abrir selects/menus no desplace sidebar ni deje huecos.
 */
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";

import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/navbar";
import Sidebar from "../components/sidebar";
import SidebarItem from "../components/sidebarItem";
import { sidebarConfig } from "../config/sidebarConfig";
import { SidebarContext } from "../context/sidebarContext";

function Layout() {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentRole } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const renderNavItems = () =>
    sidebarConfig
      .filter((item) => item.roles.includes(currentRole))
      .map((item) => {
        const variantContent = item.variants?.[currentRole] ?? item.text;
        return (
          <SidebarItem
            key={item.text}
            icon={item.icon}
            text={variantContent}
            path={item.path}
          />
        );
      });

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "relative z-40 hidden h-full shrink-0 overflow-visible md:flex",
          "flex-col border-r border-border bg-background text-primary",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "will-change-[width]",
          desktopOpen ? "w-65" : "w-18",
        )}
      >
        <SidebarContext.Provider value={{ isOpen: desktopOpen }}>
          <Sidebar
            isOpen={desktopOpen}
            setIsOpen={setDesktopOpen}
            showCollapse
          >
            {renderNavItems()}
          </Sidebar>
        </SidebarContext.Provider>
      </aside>

      {/* Mobile drawer */}
      <div
        className={clsx(
          "fixed inset-0 z-50 md:hidden",
          !mobileOpen && "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={clsx(
            "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={clsx(
            "absolute left-0 top-0 flex h-full w-[min(18.5rem,86vw)] flex-col border-r border-border bg-background text-primary",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "shadow-[var(--shadow-sidebar)]",
            "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "will-change-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarContext.Provider
            value={{
              isOpen: true,
              closeMobile: () => setMobileOpen(false),
            }}
          >
            <Sidebar
              isOpen
              setIsOpen={() => undefined}
              showCollapse={false}
              onCloseMobile={() => setMobileOpen(false)}
            >
              {renderNavItems()}
            </Sidebar>
          </SidebarContext.Provider>
        </aside>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 shrink-0 border-b border-border/80 bg-background px-3 pt-[env(safe-area-inset-top)] sm:px-6">
          <div className="flex h-14 w-full items-center sm:h-16">
            <Navbar onMenuClick={() => setMobileOpen(true)} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 md:p-8">
          <div className="mx-auto w-full max-w-7xl min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
