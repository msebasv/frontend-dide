/**
 * Proveedor de autenticación y roles.
 *
 * Al iniciar la app:
 * 1. Obtiene el perfil del usuario desde Office 365 (nombre, correo).
 * 2. Consulta asignaciones de rol en Dataverse (dev_tableassignroles).
 *    Esas asignaciones solo cuentan si el proceso sigue activo.
 * 3. Verifica leader users (dev_tableleaderuserses): Líder, Coordinador DIDE,
 *    Coordinador Diseñador o Administrador. El Diseñador DIDE se obtiene de
 *    las asignaciones por proceso (assign roles).
 * 4. Expone user, roles y currentRole vía AuthContext.
 *
 * La UI no se renderiza hasta completar la carga (evita flashes sin datos).
 * El rol activo se persiste en localStorage y se restaura al recargar.
 * Para ver roles nuevos tras una asignación, recarga la página.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "../context/authContext";

import { Office365UsersService } from "../../generated/services/Office365UsersService";
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tableleaderusersesService } from "../../generated/services/Dev_tableleaderusersesService";
import { Dev_tablevirtualizationprocessesService } from "../../generated/services/Dev_tablevirtualizationprocessesService";
import { Dev_tablerolesService } from "../../generated/services/Dev_tablerolesService";
import {
  canonicalizeUserRole,
  LEADER_USERS_ONLY_ROLES,
  USER_ROLES,
} from "../constants/domainConstants";
import { isActiveDataverseRecord } from "../utils/dataverseState";
import { escapeODataString } from "../utils/inputValidation";

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
  _dev_tablevirtualizationprocess_value?: string;
  dev_tablerolename?: string;
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
  statecode?: number | string;
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

const guidKey = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/[{}]/g, "")
    .trim()
    .toLowerCase();

/**
 * Un rol de proceso (autor, líder, validador, asesor, diseñador) solo existe
 * mientras ese proceso esté activo. Si era la única asignación, el rol desaparece.
 */
const activeProcessIdsForAssignments = async (
  assignments: DevTableAssignRole[],
): Promise<Set<string>> => {
  const processIds = new Map<string, string>();
  for (const item of assignments) {
    const raw = item._dev_tablevirtualizationprocess_value?.replace(/[{}]/g, "").trim();
    const key = guidKey(raw);
    if (key && raw) processIds.set(key, raw);
  }
  const activeIds = new Set<string>();

  await Promise.all(
    [...processIds.entries()].map(async ([key, processId]) => {
      try {
        const result = await Dev_tablevirtualizationprocessesService.get(
          processId,
          {
            select: ["dev_tablevirtualizationprocessid", "statecode"],
          },
        );
        if (isActiveDataverseRecord(result.data?.statecode)) {
          activeIds.add(key);
        }
      } catch {
        // Sin proceso activo, esa asignación no otorga rol.
      }
    }),
  );

  return activeIds;
};

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

  const assignData = ((rolesResult.data as DevTableAssignRole[]) ?? []).filter(
    (item) => isActiveDataverseRecord(item.statecode),
  );
  const activeProcessIds = await activeProcessIdsForAssignments(assignData);
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

  // Roles de proceso solo si la asignación y el proceso siguen activos.
  // Admin y coordinadores siguen saliendo de Usuarios líderes.
  const userRoles = assignData
    .filter((item) =>
      activeProcessIds.has(
        guidKey(item._dev_tablevirtualizationprocess_value),
      ),
    )
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
    } catch {
      // El rol actual se conserva si la recarga falla.
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
      } catch {
        // Sin perfil no se abre la sesión.
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, [applyRoles]);

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
