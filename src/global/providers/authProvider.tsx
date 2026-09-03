/**
 * Proveedor de autenticación y roles.
 *
 * Al iniciar la app:
 * 1. Obtiene el perfil del usuario desde Office 365 (nombre, correo).
 * 2. Consulta asignaciones de rol en Dataverse (dev_tableassignroles).
 * 3. Verifica leader users (dev_tableleaderuserses): Líder, Coordinador DIDE,
 *    Diseñador DIDE o Administrador.
 * 4. Expone user, roles y currentRole vía AuthContext.
 *
 * La UI no se renderiza hasta completar la carga (evita flashes sin datos).
 * El rol activo se persiste en localStorage y se restaura al recargar.
 * Los roles se refrescan en segundo plano (polling / foco) para detectar
 * nuevas asignaciones sin recargar la página.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "../context/authContext";

import { Office365UsersService } from "../../generated/services/Office365UsersService";
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tableleaderusersesService } from "../../generated/services/Dev_tableleaderusersesService";
import { Dev_tablerolesService } from "../../generated/services/Dev_tablerolesService";
import {
  canonicalizeUserRole,
  LEADER_USERS_ONLY_ROLES,
  USER_ROLES,
} from "../constants/domainConstants";
import { escapeODataString } from "../utils/inputValidation";
import { usePollingRefresh } from "../hooks/usePollingRefresh";

interface AuthProviderProps {
  children: ReactNode;
}

interface User {
  name: string;
  email: string;
}

interface DevTableAssignRole {
  dev_person?: string;
  dev_tableassignroleid?: string;
  _dev_tablerole_value?: string;
  dev_tablerolename?: string;
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
}

interface LeaderUser {
  dev_useremail?: string;
  /** Nombre del rol asociado en Dataverse (p. ej. Coordinador DIDE). */
  dev_tablerolename?: string;
  _dev_tablerole_value?: string;
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
  statecode?: number | string;
}

const roleStorageKey = (email: string) =>
  `academicplus:currentRole:${email.toLowerCase()}`;

const sameRoles = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((role, index) => role === sortedB[index]);
};

const resolveRoleDisplayName = (
  item: {
    dev_tablerolename?: string;
    _dev_tablerole_value?: string;
    "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
  },
  roleNameById: Map<string, string>,
): string =>
  item.dev_tablerolename?.trim() ||
  item[
    "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
  ]?.trim() ||
  (item._dev_tablerole_value
    ? roleNameById.get(item._dev_tablerole_value)
    : undefined) ||
  "";

const fetchUserRoles = async (email: string): Promise<string[]> => {
  const [rolesResult, leaderResult, rolesCatalog] = await Promise.all([
    Dev_tableassignrolesService.getAll({
      filter: `dev_person eq '${escapeODataString(email)}'`,
    }),
    Dev_tableleaderusersesService.getAll({
      filter: `dev_useremail eq '${escapeODataString(email)}'`,
    }),
    Dev_tablerolesService.getAll(),
  ]);

  const assignData = (rolesResult.data as DevTableAssignRole[]) ?? [];
  const leaderData = ((leaderResult.data as LeaderUser[]) ?? []).filter(
    (item) => {
      // Solo filas activas otorgan rol. statecode 0 = Active; ausente = legacy activo.
      if (item.statecode === undefined || item.statecode === null) return true;
      return Number(item.statecode) === 0;
    },
  );

  const roleNameById = new Map<string, string>();
  for (const role of rolesCatalog.data ?? []) {
    if (role.dev_tableroleid && role.dev_namerole) {
      roleNameById.set(role.dev_tableroleid, role.dev_namerole.trim());
    }
  }

  // Roles globales (Admin, Coordinador DIDE, Diseñador DIDE) solo desde leader-users.
  // Líder de virtualización también puede asignarse por proceso (assign roles).
  const userRoles = assignData
    .map((item) =>
      canonicalizeUserRole(resolveRoleDisplayName(item, roleNameById)),
    )
    .filter(
      (role) =>
        Boolean(role) &&
        !LEADER_USERS_ONLY_ROLES.some(
          (globalRole) => canonicalizeUserRole(globalRole) === role,
        ),
    );

  // Solo el rol enlazado en leader-users. No inventar "Líder" si hay
  // filas sin nombre de rol junto a otra con Coordinador DIDE.
  const rolesFromLeaders: string[] = [];
  let hasLeaderRowWithoutRole = false;

  for (const item of leaderData) {
    const mapped = canonicalizeUserRole(
      resolveRoleDisplayName(item, roleNameById),
    );
    if (mapped) {
      rolesFromLeaders.push(mapped);
    } else {
      hasLeaderRowWithoutRole = true;
    }
  }

  if (rolesFromLeaders.length > 0) {
    userRoles.push(...rolesFromLeaders);
  } else if (hasLeaderRowWithoutRole || leaderData.length > 0) {
    // Filas legacy sin lookup de rol → se tratan como líder.
    userRoles.push(USER_ROLES.LEADER);
  }

  return [...new Set(userRoles)];
};

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [currentRole, setCurrentRoleState] = useState("");
  const [loading, setLoading] = useState(true);

  const setCurrentRole: React.Dispatch<React.SetStateAction<string>> = (
    value,
  ) => {
    setCurrentRoleState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (user?.email && next) {
        localStorage.setItem(roleStorageKey(user.email), next);
      }
      return next;
    });
  };

  const applyRoles = useCallback((email: string, uniqueRoles: string[]) => {
    setRoles((prev) => (sameRoles(prev, uniqueRoles) ? prev : uniqueRoles));

    if (uniqueRoles.length === 0) {
      setCurrentRoleState("");
      return;
    }

    setCurrentRoleState((prev) => {
      const prevCanonical = canonicalizeUserRole(prev);
      if (prevCanonical && uniqueRoles.includes(prevCanonical)) {
        return prevCanonical;
      }

      const savedRole = canonicalizeUserRole(
        localStorage.getItem(roleStorageKey(email)) ?? "",
      );
      const nextRole =
        savedRole && uniqueRoles.includes(savedRole)
          ? savedRole
          : uniqueRoles[0];

      localStorage.setItem(roleStorageKey(email), nextRole);
      return nextRole;
    });
  }, []);

  const refreshRoles = useCallback(async () => {
    if (!user?.email) return;

    try {
      const uniqueRoles = await fetchUserRoles(user.email);
      applyRoles(user.email, uniqueRoles);
    } catch (error) {
      console.error("Error refreshing roles:", error);
    }
  }, [user?.email, applyRoles]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const profileResult = await Office365UsersService.MyProfile();
        const profile = profileResult.data;

        const currentUser: User = {
          name: profile.DisplayName || "",
          email: profile.Mail || "",
        };

        setUser(currentUser);

        const uniqueRoles = await fetchUserRoles(currentUser.email);
        applyRoles(currentUser.email, uniqueRoles);
      } catch (error) {
        console.error("Error loading auth:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, [applyRoles]);

  usePollingRefresh(refreshRoles, 60_000, Boolean(user?.email) && !loading);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        currentRole,
        setCurrentRole,
        refreshRoles,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
