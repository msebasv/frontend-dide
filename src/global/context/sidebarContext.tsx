import { createContext, useContext } from "react";

interface SidebarContextProps {
  isOpen: boolean;
  /** Cierra el drawer en móvil al navegar. */
  closeMobile?: () => void;
}

export const SidebarContext = createContext<SidebarContextProps>({
  isOpen: true,
});

export const useSidebar = () => {
  return useContext(SidebarContext);
};
