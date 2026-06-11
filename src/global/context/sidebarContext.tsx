import { createContext, useContext } from "react";

interface SidebarContextProps {
  isOpen: boolean;
}

export const SidebarContext = createContext<SidebarContextProps>({
  isOpen: true,
});

export const useSidebar = () => {
  return useContext(SidebarContext);
};
