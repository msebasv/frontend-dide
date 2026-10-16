/**
 * Contexto del estado expandido o colapsado de la barra lateral.
 */
import { createContext, useContext } from "react";

interface SidebarContextProps {
  isOpen: boolean;
  /** Cierra el drawer en móvil al navegar. */
  closeMobile?: () => void;
}

/** Contexto de apertura/cierre del sidebar y drawer móvil. */
export const SidebarContext = createContext<SidebarContextProps>({
  isOpen: true,
});

/** Hook del estado del sidebar; requiere SidebarProvider. */
export const useSidebar = () => {
  return useContext(SidebarContext);
};
