import { createContext } from "react";

interface User {
  name: string;
  email: string;
}

export interface AuthContextProps {
  user: User | null;
  roles: string[];
  currentRole: string;

  setCurrentRole: React.Dispatch<React.SetStateAction<string>>;
}

export const AuthContext = createContext<AuthContextProps>({
  user: null,
  roles: [],
  currentRole: "",
  setCurrentRole: () => {},
});
