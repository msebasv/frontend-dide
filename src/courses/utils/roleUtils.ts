/**
 * Resolución de GUIDs de roles Dataverse a partir de nombres canónicos
 * (líder, autor, validador, asesor, diseñador DIDE).
 */
import type { Dev_tableroles } from "../../generated/models/Dev_tablerolesModel";
import {
  normalizeRoleKey,
  USER_ROLES,
} from "../../global/constants/domainConstants";

/** Busca el GUID del rol cuyo nombre coincide con alguna variante esperada. */
export const findRoleId = (
  roles: Dev_tableroles[],
  expectedNames: string[],
): string => {
  const expected = expectedNames.map(normalizeRoleKey);

  const role = roles.find((item) => {
    const roleName = normalizeRoleKey(item.dev_namerole ?? "");
    return expected.includes(roleName);
  });

  return role?.dev_tableroleid ?? "";
};

/** GUIDs Dataverse de los roles operativos de un proceso de virtualización. */
export type ProcessRoleIds = {
  leader: string;
  author: string;
  validator: string;
  advisor: string;
  designer: string;
};

/** Mapa líder/autor/validador/asesor/diseñador → GUID en Dataverse. */
export const resolveProcessRoleIds = (
  roles: Dev_tableroles[],
): ProcessRoleIds => ({
  leader: findRoleId(roles, [USER_ROLES.LEADER]),
  author: findRoleId(roles, [USER_ROLES.AUTHOR]),
  validator: findRoleId(roles, [USER_ROLES.VALIDATOR]),
  advisor: findRoleId(roles, [USER_ROLES.ADVISOR]),
  designer: findRoleId(roles, [USER_ROLES.DIDE_DESIGNER]),
});
