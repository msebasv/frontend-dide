import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Outlet } from "react-router-dom";
import Navbar from "../components/navbar";
import Sidebar from "../components/sidebar";
import SidebarItem from "../components/sidebarItem";
import { sidebarConfig } from "../config/sidebarConfig";

function Layout() {
  const [isOpen, setIsOpen] = useState(true);
  const { currentRole } = useAuth();
  return (
    <div className="flex min-h-screen bg-background">
      {/* SIDEBAR */}
      <aside
        className={`
          hidden
          md:flex
          ${isOpen ? "w-64" : "w-20"}
          flex-col
          border-r
          shadow-sm
          border-gray-200
          bg-primary
          text-white
        `}
      >
        <Sidebar isOpen={isOpen} setIsOpen={setIsOpen}>
          {sidebarConfig
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
            })}
        </Sidebar>
      </aside>

      {/* CONTENT */}
      <div className="flex flex-1 flex-col">
        {/* NAVBAR */}
        <header
          className="
            h-16
            border-b
            border-gray-200
            bg-surface
            pl-10
            pr-6
          "
        >
          <Navbar />
        </header>

        {/* MAIN */}
        <main
          className="
            flex-1
            overflow-y-auto
            p-6
          "
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
