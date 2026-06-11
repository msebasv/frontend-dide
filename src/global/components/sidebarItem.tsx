import { type ReactNode } from "react";
import { useSidebar } from "../context/sidebarContext";
import { NavLink } from "react-router-dom";

interface SidebarItemProps {
  icon: ReactNode;
  text: string;
  path: string; // 👈 ahora recibe la ruta
}

const SidebarItem = ({ icon, text, path }: SidebarItemProps) => {
  const { isOpen } = useSidebar();

  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `relative flex items-center text-size-sm py-3 px-4 my-1 rounded-xs cursor-pointer transition-colors group ${
          isActive
            ? "bg-white/20 text-white border-l-4 border-l-secondary"
            : "text-gray-300 hover:bg-gray-50 hover:text-gray-900"
        }`
      }
    >
      {icon}
      <span
        className={`overflow-hidden whitespace-nowrap transition-all ${
          isOpen ? "w-52 ml-3 font-medium" : "w-0 ml-0"
        }`}
      >
        {text}
      </span>

      {!isOpen && (
        <div
          className={`
            w-52 absolute left-full rounded-md px-4 py-2 ml-6 bg-primary text-white text-sm invisible opacity-20 -translate-x-3 transition-all group-hover:visible group-hover:opacity-100 group-hover:translate-x-0`}
        >
          {text}
        </div>
      )}
    </NavLink>
  );
};

export default SidebarItem;
