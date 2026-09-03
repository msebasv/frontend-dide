import { useContext } from "react";

import { AuthContext } from "../context/authContext";

/**
 * Hook de acceso al contexto de autenticación.
 * @returns Perfil, roles y rol activo del usuario actual.
 */
export const useAuth = () => useContext(AuthContext);
