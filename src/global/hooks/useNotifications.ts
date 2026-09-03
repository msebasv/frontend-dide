/**
 * Hook de notificaciones por rol.
 * Carga pendientes al montar, al cambiar de rol/usuario y en segundo plano.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { getCoursesForUser } from "../../courses/services/courseService";
import { getVirtualizationProcesses } from "../../processVirtualization/services/processService";
import { isLeaderRole, USER_ROLES } from "../constants/domainConstants";
import type { AppNotification } from "../types/notification.types";
import {
  buildCourseNotifications,
  buildLeaderNotifications,
} from "../utils/notificationUtils";
import { usePollingRefresh } from "./usePollingRefresh";

export const useNotifications = (userEmail: string, role: string) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userEmail || !role) {
        setNotifications([]);
        hasLoadedRef.current = false;
        return;
      }

      const silent = options?.silent && hasLoadedRef.current;

      try {
        if (!silent) setLoading(true);

        if (isLeaderRole(role)) {
          const processes = await getVirtualizationProcesses();
          setNotifications(buildLeaderNotifications(processes));
          return;
        }

        if (
          role === USER_ROLES.AUTHOR ||
          role === USER_ROLES.VALIDATOR ||
          role === USER_ROLES.ADVISOR ||
          role === USER_ROLES.DIDE_DESIGNER
        ) {
          const courses = await getCoursesForUser(userEmail, role);
          setNotifications(buildCourseNotifications(courses, role));
          return;
        }

        setNotifications([]);
      } catch (error) {
        console.error("Error cargando notificaciones", error);
        if (!silent) setNotifications([]);
      } finally {
        hasLoadedRef.current = true;
        if (!silent) setLoading(false);
      }
    },
    [userEmail, role],
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    void loadNotifications();
  }, [loadNotifications]);

  usePollingRefresh(
    () => loadNotifications({ silent: true }),
    60_000,
    Boolean(userEmail && role),
  );

  return {
    notifications,
    loading,
    refresh: () => loadNotifications({ silent: true }),
  };
};
