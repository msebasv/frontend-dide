/**
 * Configuración del menú lateral.
 *
 * Cada ítem declara qué roles pueden verlo (`roles`).
 * El Layout filtra esta lista con `currentRole` del AuthContext.
 * `variants` permite personalizar el texto según el rol (ej. "Mis Cursos" → "Cursos por validar").
 */
import { IoHomeOutline, IoStatsChartOutline, IoPeopleOutline, IoIdCardOutline, IoListOutline, IoAlbumsOutline } from "react-icons/io5";
import { RiGraduationCapLine } from "react-icons/ri";
import { GoWorkflow } from "react-icons/go";
import { HiOutlineAcademicCap } from "react-icons/hi2";
import { USER_ROLES } from "../constants/domainConstants";

interface SidebarItemConfig {
  text: string;
  icon: React.ReactNode;
  roles: string[];
  variants?: Record<string, string>;
  path: string;
}

const MANAGEMENT_ROLES = [
  USER_ROLES.LEADER,
  USER_ROLES.DIDE_COORDINATOR,
  USER_ROLES.ADMIN,
] as const;

export const sidebarConfig: SidebarItemConfig[] = [
  {
    text: "Inicio",
    icon: <IoHomeOutline size={20} />,
    roles: [
      USER_ROLES.AUTHOR,
      USER_ROLES.LEADER,
      USER_ROLES.DIDE_COORDINATOR,
      USER_ROLES.ADMIN,
      USER_ROLES.DIDE_DESIGNER,
      USER_ROLES.VALIDATOR,
      USER_ROLES.ADVISOR,
    ],
    path: "/",
    variants: {
      [USER_ROLES.AUTHOR]: "Dashboard de cursos",
      [USER_ROLES.LEADER]: "Panel de procesos",
      [USER_ROLES.DIDE_COORDINATOR]: "Panel de procesos",
      [USER_ROLES.ADMIN]: "Panel de administración",
      [USER_ROLES.VALIDATOR]: "Panel de validación",
      [USER_ROLES.ADVISOR]: "Panel de asesoría",
      [USER_ROLES.DIDE_DESIGNER]: "Panel de diseño DIDE",
    },
  },
  {
    text: "Mis Cursos",
    icon: <RiGraduationCapLine size={20} />,
    roles: [
      USER_ROLES.AUTHOR,
      USER_ROLES.VALIDATOR,
      USER_ROLES.ADVISOR,
      USER_ROLES.DIDE_DESIGNER,
    ],
    path: "/my-courses",
    variants: {
      [USER_ROLES.VALIDATOR]: "Cursos por validar",
      [USER_ROLES.ADVISOR]: "Cursos pendientes",
      [USER_ROLES.DIDE_DESIGNER]: "Cursos por aprobar",
    },
  },
  {
    text: "Procesos de Virtualización",
    icon: <GoWorkflow size={20} />,
    roles: [USER_ROLES.LEADER, USER_ROLES.ADMIN],
    path: "/virtualization-processes",
  },
  {
    text: "Estadísticas",
    icon: <IoStatsChartOutline size={20} />,
    roles: [...MANAGEMENT_ROLES, USER_ROLES.ADVISOR],
    path: "/statistics",
    variants: {
      [USER_ROLES.ADVISOR]: "Estadísticas de mis procesos",
      [USER_ROLES.LEADER]: "Estadísticas de mis procesos",
      [USER_ROLES.DIDE_COORDINATOR]: "Estadísticas",
      [USER_ROLES.ADMIN]: "Estadísticas",
    },
  },
  {
    text: "Seguimiento",
    icon: <IoListOutline size={20} />,
    roles: [...MANAGEMENT_ROLES, USER_ROLES.ADVISOR],
    path: "/tracking",
    variants: {
      [USER_ROLES.ADVISOR]: "Seguimiento de mis procesos",
      [USER_ROLES.LEADER]: "Seguimiento de procesos",
      [USER_ROLES.DIDE_COORDINATOR]: "Seguimiento de procesos",
      [USER_ROLES.ADMIN]: "Seguimiento de procesos",
    },
  },
  {
    text: "Programas",
    icon: <HiOutlineAcademicCap size={20} />,
    roles: [USER_ROLES.ADMIN],
    path: "/admin/programs",
    variants: {
      [USER_ROLES.ADMIN]: "Programas y facultades",
    },
  },
  {
    text: "Personas",
    icon: <IoIdCardOutline size={20} />,
    roles: [USER_ROLES.ADMIN],
    path: "/admin/people",
  },
  {
    text: "Entregables",
    icon: <IoAlbumsOutline size={20} />,
    roles: [USER_ROLES.ADMIN, USER_ROLES.DIDE_COORDINATOR],
    path: "/admin/categories",
  },
  {
    text: "Usuarios líderes",
    icon: <IoPeopleOutline size={20} />,
    roles: [USER_ROLES.ADMIN],
    path: "/admin/leader-users",
  },
];
