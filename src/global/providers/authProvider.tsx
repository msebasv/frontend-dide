import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "../context/authContext";

import { Office365UsersService } from "../../generated/services/Office365UsersService";
import { Dev_tableassignrolesService } from "../../generated/services/Dev_tableassignrolesService";
import { Dev_tableleaderusersesService } from "../../generated/services/Dev_tableleaderusersesService";

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
  "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"?: string;
}

interface LeaderUser {
  "user-email"?: string;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [currentRole, setCurrentRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // USER PROFILE
        const profileResult = await Office365UsersService.MyProfile();
        const profile = profileResult.data;

        const currentUser: User = {
          name: profile.DisplayName || "",
          email: profile.Mail || "",
        };

        setUser(currentUser);

        // ASSIGN ROLES
        const rolesResult = await Dev_tableassignrolesService.getAll({
          filter: `dev_person eq '${currentUser.email}'`,
        });

        const data = rolesResult.data as DevTableAssignRole[];

        const userRoles = data
          .map(
            (item) =>
              item[
                "_dev_tablerole_value@OData.Community.Display.V1.FormattedValue"
              ] || "",
          )
          .filter(Boolean);

        // LEADER USERS
        const leaderResult = await Dev_tableleaderusersesService.getAll({
          filter: `dev_useremail eq '${currentUser.email}'`,
        });

        const leaderData = leaderResult.data as LeaderUser[];

        if (leaderData.length > 0) {
          userRoles.push("Líder de virtualización");
        }

        // REMOVE DUPLICATES
        const uniqueRoles = [...new Set(userRoles)];
        setRoles(uniqueRoles);

        // DEFAULT ROLE
        if (uniqueRoles.length > 0) {
          setCurrentRole(uniqueRoles[0]);
        }
      } catch (error) {
        console.error("Error loading auth:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        currentRole,
        setCurrentRole,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
