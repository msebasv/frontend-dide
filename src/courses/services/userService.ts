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
