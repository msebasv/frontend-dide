/**
 * Documentación de arquitectura de AcademicPlus.
 *
 * Esta app es una Power Apps Code App (React + Vite) que gestiona el proceso
 * de virtualización de asignaturas en la Universidad El Bosque.
 *
 * Capas (de arriba hacia abajo):
 *
 * 1. Pages — pantallas: orquestan UI con hooks; no llaman Dataverse directo.
 * 2. Hooks — estado local (loading, datos, errores) y recarga.
 * 3. Services — datos y acciones; coordinan capa generada y flujos.
 * 4. Mappers — registros Dataverse → tipos de dominio para la UI.
 * 5. Generated (src/generated) — cliente CLI; no editar a mano.
 *
 * Módulos de negocio:
 * - courses — Mis cursos, detalle, carga y validación de material
 * - processVirtualization — Gestión global de procesos (solo líder)
 * - tracking — Seguimiento de procesos por entregable
 * - statistics — Analítica para el líder de virtualización
 * - home — Dashboards por rol
 * - global — Layout, auth, componentes reutilizables, config
 *
 * Autenticación y roles:
 * El AuthProvider obtiene el perfil de Office 365, consulta asignaciones
 * en Dataverse y determina los roles del usuario. El sidebar y cada página
 * filtran contenido según currentRole.
 *
 * Enrutamiento en Power Apps:
 * Se usa HashRouter (no BrowserRouter) porque la app corre dentro de un iframe
 * con URL dinámica del runtime de Power Apps. Las rutas son del tipo #/tracking.
 *
 * Despliegue:
 * npm run build
 * npx power-apps push
 */

export {};
