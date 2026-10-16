/**
 * Contexto global de autenticación.
 *
 * Consumido por useAuth() en cualquier componente que necesite
 * el usuario actual, sus roles o cambiar el rol activo.
 */
import { createContext } from "react";

interface User {
  name: string;
  email: string;
}

/** Valores expuestos por el contexto de autenticación. */
export interface AuthContextProps {
  /** Usuario autenticado; null si aún no se cargó o falló la consulta. */
  user: User | null;
  /** Todos los roles asignados al usuario en el sistema. */
  roles: string[];
  /** Rol activo seleccionado (afecta sidebar, dashboards y permisos). */
  currentRole: string;
  setCurrentRole: React.Dispatch<React.SetStateAction<string>>;
  /** Vuelve a consultar roles en Dataverse sin recargar la página. */
  refreshRoles: () => Promise<void>;
}

/** Contexto React de usuario, roles y rol activo. */
export const AuthContext = createContext<AuthContextProps>({
  user: null,
  roles: [],
  currentRole: "",
  setCurrentRole: () => {},
  refreshRoles: async () => {},
});
