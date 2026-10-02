import { Office365UsersService } from "../../generated/services/Office365UsersService";

export const ORGANIZATION_EMAIL_DOMAIN = "unbosque.edu.co";

export interface OrganizationUser {
  email: string;
  name: string;
}

const matchesOrganizationDomain = (email: string | undefined): boolean =>
  Boolean(email?.toLowerCase().endsWith(`@${ORGANIZATION_EMAIL_DOMAIN}`));

export const isOrganizationEmail = (email: string): boolean =>
  /^[a-z0-9._%+-]+@unbosque\.edu\.co$/i.test(email.trim());

/**
 * True si el correo existe en el directorio del tenant y es @unbosque.edu.co.
 * Lanza si el directorio no responde, para no tratar un fallo de red como "no existe".
 */
export const organizationUserExists = async (email: string): Promise<boolean> => {
  const normalized = email.trim().toLowerCase();
  if (!isOrganizationEmail(normalized)) return false;

  try {
    const profile = await Office365UsersService.UserProfile_V2(
      normalized,
      "mail,userPrincipalName",
    );
    const mail = profile.data?.mail?.trim().toLowerCase();
    const upn = profile.data?.userPrincipalName?.trim().toLowerCase();
    if (profile.success !== false && (mail === normalized || upn === normalized)) {
      return true;
    }
  } catch {
    // El perfil por identificador a veces no acepta el correo. Se confirma con la búsqueda.
  }

  try {
    const matches = await searchOrganizationUsers(normalized);
    return matches.some((user) => user.email.trim().toLowerCase() === normalized);
  } catch {
    throw new Error(
      "No se pudo comprobar si el correo existe en el directorio. Intente de nuevo.",
    );
  }
};

export const assertDirectoryEmails = async (emails: string[]): Promise<void> => {
  const unique = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ];

  for (const email of unique) {
    const exists = await organizationUserExists(email);
    if (!exists) {
      throw new Error(
        `El correo ${email} no existe en el directorio de ${ORGANIZATION_EMAIL_DOMAIN}.`,
      );
    }
  }
};

export const searchOrganizationUsers = async (
  query: string,
): Promise<OrganizationUser[]> => {
  const searchTerm = query.trim();
  if (searchTerm.length < 2) return [];

  try {
    const result = await Office365UsersService.SearchUserV2(
      searchTerm,
      15,
      true,
    );

    return (result.data?.value ?? [])
      .filter((user) => matchesOrganizationDomain(user.Mail))
      .map((user) => ({
        email: user.Mail!.trim(),
        name: user.DisplayName?.trim() || user.Mail!.trim(),
      }));
  } catch {
    const fallback = await Office365UsersService.SearchUser(searchTerm, 15);

    return (fallback.data ?? [])
      .filter((user) => matchesOrganizationDomain(user.Mail))
      .map((user) => ({
        email: user.Mail!.trim(),
        name: user.DisplayName?.trim() || user.Mail!.trim(),
      }));
  }
};
