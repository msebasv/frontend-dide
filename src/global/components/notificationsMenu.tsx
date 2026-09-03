import { Link } from "react-router-dom";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoNotificationsOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";

import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../hooks/useNotifications";
import type { AppNotification } from "../types/notification.types";

const kindIcon = (kind: AppNotification["kind"]) => {
  if (kind === "upload") return <IoCloudUploadOutline size={16} />;
  if (kind === "validate") return <IoShieldCheckmarkOutline size={16} />;
  return <IoCheckmarkCircleOutline size={16} />;
};

const kindStyles: Record<AppNotification["kind"], string> = {
  upload: "bg-warning/10 text-warning",
  validate: "bg-accent/10 text-accent",
  review: "bg-secondary/10 text-secondary",
};

function NotificationsMenu() {
  const { user, currentRole } = useAuth();
  const { notifications, loading } = useNotifications(
    user?.email ?? "",
    currentRole,
  );

  const count = notifications.length;

  return (
    <Menu>
      <MenuButton
        className="relative inline-flex rounded-full p-2 text-muted transition hover:bg-acacia-10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30"
        aria-label="Notificaciones"
      >
        <IoNotificationsOutline size={20} />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </MenuButton>

      <MenuItems
        transition
        anchor="bottom end"
        modal={false}
        className="z-[60] w-[min(22rem,calc(100vw-1.5rem))] origin-top-right rounded-3xl border border-border bg-surface p-1.5 shadow-[var(--shadow-card-hover)] transition duration-150 focus:outline-none data-closed:scale-95 data-closed:opacity-0"
      >
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold text-primary">Notificaciones</p>
          <p className="text-xs text-muted">
            Pendientes según tu rol activo
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              Cargando pendientes...
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No tienes pendientes por ahora
            </p>
          ) : (
            notifications.map((item) => (
              <MenuItem key={item.id}>
                <Link
                  to={item.link}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition data-focus:bg-primary/5"
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${kindStyles[item.kind]}`}
                  >
                    {kindIcon(item.kind)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-primary">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </MenuItem>
            ))
          )}
        </div>
      </MenuItems>
    </Menu>
  );
}

export default NotificationsMenu;
