import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "react-router-dom";
import { sidebarConfig } from "../config/sidebarConfig";
import ChangeRoleModal from "./changeRoleModal";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { FaExchangeAlt } from "react-icons/fa";

const Navbar = () => {
  const { user, currentRole } = useAuth();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Función para obtener las iniciales del usuario
  const getInitialNameUser = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return "";

    const firstNameInitial = parts[0][0].toUpperCase();
    const lastNameInitial = parts.length > 1 ? parts[1][0].toUpperCase() : "";

    return firstNameInitial + lastNameInitial;
  };

  const name = getInitialNameUser(user?.name || "");

  // Busca el ítem que coincide con la ruta actual
  const currentItem = sidebarConfig.find(
    (item) => item.path === location.pathname,
  );

  // Determina el título según el rol
  const title = currentItem
    ? (currentItem.variants?.[currentRole] ?? currentItem.text)
    : "Inicio";

  return (
    <div className="flex items-center justify-between h-full">
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      <div className="flex items-center h-8 gap-6">
        <div className="items-center">
          <h4>{user?.name}</h4>
          <h3 className="text-xs text-gray-600">Rol: {currentRole}</h3>
        </div>
        <div className="flex w-px bg-gray-400/40 h-full" />
        <Menu>
          <MenuButton className="inline-flex items-center gap-2 rounded-full bg-gray-800 px-2 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-gray-700 data-open:bg-gray-700">
            {name}
          </MenuButton>

          <MenuItems
            transition
            anchor="bottom end"
            className="w-52 origin-top-right rounded-xl border border-primary/5 bg-primary/5 p-1 text-sm/6 text-black transition duration-100 ease-out [--anchor-gap:--spacing(1)] focus:outline-none data-closed:scale-95 data-closed:opacity-0"
          >
            <MenuItem>
              <button
                onClick={() => setIsModalOpen(true)}
                className="group flex w-full items-center gap-2 rounded-lg px-3 py-1.5 data-focus:bg-primary/10"
              >
                <FaExchangeAlt className="size-4 fill-primary/30" />
                Cambiar Rol
                <kbd className="ml-auto hidden font-sans text-xs text-primary/50 group-data-focus:inline">
                  ⌘C
                </kbd>
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>

      {/* Modal */}
      <ChangeRoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Navbar;
