import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "react-router-dom";
import { getPageTitle } from "../config/routeConfig";
import ChangeRoleModal from "./changeRoleModal";
import NotificationsMenu from "./notificationsMenu";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { FaExchangeAlt } from "react-icons/fa";
import { IoChevronDown, IoMenuOutline } from "react-icons/io5";
import { formatDomainLabel } from "../utils/textUtils";

interface NavbarProps {
  onMenuClick?: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { user, currentRole } = useAuth();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getInitialNameUser = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return "";
    const firstNameInitial = parts[0][0].toUpperCase();
    const lastNameInitial = parts.length > 1 ? parts[1][0].toUpperCase() : "";
    return firstNameInitial + lastNameInitial;
  };

  const initials = getInitialNameUser(user?.name || "");
  const title = getPageTitle(location.pathname);

  return (
    <div className="flex h-full w-full min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-primary transition hover:bg-white md:hidden"
            aria-label="Abrir menú"
          >
            <IoMenuOutline size={22} />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-primary sm:text-lg">
            {title}
          </h1>
          <p className="hidden truncate text-xs text-muted sm:block">
            Universidad El Bosque · DiDE
          </p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden rounded-full bg-acacia-10 px-3 py-1 text-xs font-semibold text-primary lg:inline-block">
          {formatDomainLabel(currentRole)}
        </span>

        <NotificationsMenu />

        <div className="hidden h-8 w-px bg-border md:block" />

        <div className="hidden text-right md:block">
          <p className="max-w-[10rem] truncate text-sm font-semibold text-primary lg:max-w-none">
            {user?.name}
          </p>
          <p className="max-w-[10rem] truncate text-xs text-muted lg:max-w-none">
            {user?.email}
          </p>
        </div>

        <Menu>
          <MenuButton
            aria-label="Abrir menú de usuario y rol"
            className="group flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-0.5 pr-1.5 shadow-sm transition hover:border-secondary/50 hover:bg-acacia-10 data-open:border-secondary data-open:bg-acacia-10"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {initials}
            </span>
            <IoChevronDown
              size={16}
              className="text-muted transition group-data-open:rotate-180 group-data-open:text-primary"
            />
          </MenuButton>

          <MenuItems
            transition
            anchor="bottom end"
            modal={false}
            className="z-[60] w-56 origin-top-right rounded-3xl border border-border bg-surface p-1.5 shadow-[var(--shadow-card-hover)] transition duration-150 focus:outline-none data-closed:scale-95 data-closed:opacity-0"
          >
            <div className="border-b border-border px-3 py-2.5 md:hidden">
              <p className="truncate text-sm font-semibold text-primary">
                {user?.name}
              </p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Rol activo
              </p>
              <p className="mt-0.5 text-sm font-medium text-primary">
                {formatDomainLabel(currentRole)}
              </p>
            </div>
            <MenuItem>
              <button
                onClick={() => setIsModalOpen(true)}
                className="group flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-sm text-primary data-focus:bg-acacia-10"
              >
                <FaExchangeAlt className="text-muted" size={14} />
                Cambiar rol
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>

      <ChangeRoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Navbar;
