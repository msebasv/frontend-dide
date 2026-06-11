import { IoHomeOutline } from "react-icons/io5";
import { RiGraduationCapLine } from "react-icons/ri";
import { GoWorkflow } from "react-icons/go";

interface SidebarItemConfig {
  text: string;
  icon: React.ReactNode;
  roles: string[];
  variants?: Record<string, string>; // contenido dinámico por rol
  path: string;
}

export const sidebarConfig: SidebarItemConfig[] = [
  {
    text: "Inicio",
    icon: <IoHomeOutline size={20} />,
    roles: [
      "Autor de asignatura",
      "Líder de virtualización",
      "Coordinador DIDE",
      "Diseñador DIDE",
      "Validador Disciplinar",
      "Asesor pedagógico",
    ],
    path: "/",
    variants: {
      // "Autor de asignatura": "Dashboard de cursos",
      // "Líder de virtualización": "Panel de procesos",
    },
  },
  {
    text: "Mis Cursos",
    icon: <RiGraduationCapLine size={20} />,
    roles: ["Autor de asignatura", "Validador Disciplinar"],
    path: "/my-courses",
  },
  {
    text: "Procesos de Virtualización",
    icon: <GoWorkflow size={20} />,
    roles: ["Líder de virtualización"],
    path: "/virtualization-processes",
  },
];
