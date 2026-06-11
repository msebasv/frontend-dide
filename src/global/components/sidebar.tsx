import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { SidebarContext } from "../context/sidebarContext";

interface SidebarProps {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar = ({ children, isOpen, setIsOpen }: SidebarProps) => {
  return (
    <div className="relative">
      <nav className="h-full flex flex-col">
        <div className="pt-1 pb-3 flex justify-center items-center">
          {isOpen ? (
            <img
              className={`overflow-hidden transition-all w-40 h-auto`}
              src="/src/assets/img/logo_blanco.png"
              alt=""
            />
          ) : (
            <img
              className={`overflow-hidden transition-all w-13`}
              src="/src/assets/img/logo-ub-b.png"
              alt=""
            />
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="
        absolute
        top-2
        -right-3
        z-50
        rounded-full
        bg-primary
        p-1
        text-white
        shadow-md
        transition
        hover:scale-105
      "
          >
            {isOpen ? (
              <FaChevronLeft className="text-white" size={20} />
            ) : (
              <FaChevronRight className="text-white" size={15} />
            )}
          </button>
        </div>

        <SidebarContext.Provider value={{ isOpen }}>
          <ul className="flex-1 px-3">{children}</ul>
        </SidebarContext.Provider>
      </nav>
    </div>
  );
};

export default Sidebar;
