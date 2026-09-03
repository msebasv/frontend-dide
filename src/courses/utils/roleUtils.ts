import type { Dev_tableroles } from "../../generated/models/Dev_tablerolesModel";

const normalizeRoleName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const findRoleId = (
  roles: Dev_tableroles[],
  expectedNames: string[],
): string => {
  const expected = expectedNames.map(normalizeRoleName);

  const role = roles.find((item) => {
    const roleName = normalizeRoleName(item.dev_namerole ?? "");
    return expected.includes(roleName);
  });

  return role?.dev_tableroleid ?? "";
};
