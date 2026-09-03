/**
 * Títulos de página para el navbar.
 *
 * Se resuelven por regex sobre pathname (sin el hash de HashRouter).
 * El primer patrón que coincida define el título mostrado.
 */
export const routeTitles: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/$/, title: "Inicio" },
  { pattern: /^\/my-courses$/, title: "Mis Cursos" },
  { pattern: /^\/statistics$/, title: "Estadísticas" },
  { pattern: /^\/tracking$/, title: "Seguimiento" },
  { pattern: /^\/history$/, title: "Historial" },
  { pattern: /^\/history\/[^/]+$/, title: "Historial del Proceso" },
  { pattern: /^\/virtualization-processes$/, title: "Procesos de Virtualización" },
  { pattern: /^\/virtualization-processes\/create$/, title: "Crear Proceso" },
  { pattern: /^\/virtualization-processes\/create-course$/, title: "Crear Curso" },
  { pattern: /^\/admin\/people$/, title: "Personas y roles" },
  { pattern: /^\/admin\/programs$/, title: "Programas y facultades" },
  { pattern: /^\/admin\/leader-users$/, title: "Usuarios líderes" },
  { pattern: /^\/virtualization-processes\/[^/]+$/, title: "Ver Proceso" },
  { pattern: /^\/courses\/[^/]+\/upload$/, title: "Cargar Curso" },
  { pattern: /^\/courses\/[^/]+$/, title: "Ver Curso" },
];

export const getPageTitle = (pathname: string): string => {
  const match = routeTitles.find((route) => route.pattern.test(pathname));
  return match?.title ?? "AcademicPlus";
};
