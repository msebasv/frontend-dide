/**
 * Notificaciones derivadas de pendientes reales del usuario.
 * No usa una tabla aparte: se basan en cursos/procesos según el rol.
 */
export interface AppNotification {
  id: string;
  title: string;
  description: string;
  link: string;
  kind: "upload" | "validate" | "review";
}
