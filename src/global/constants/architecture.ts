/**
 * Documentación de arquitectura de AcademicPlus.
 *
 * Esta app es una Power Apps Code App (React + Vite) que gestiona el proceso
 * de virtualización de asignaturas en la Universidad El Bosque.
 *
 * Capas (de arriba hacia abajo):
 *
 * 1. Pages (modulos pages)
 *    Pantallas que el usuario ve. Solo orquestan UI: cargan datos con hooks
 *    y renderizan componentes. No llaman a Dataverse directamente.
 *
 * 2. Hooks (modulos hooks)
 *    Estado local de cada feature (loading, datos, errores).
 *    Encapsulan cuándo y cómo recargar información.
 *
 * 3. Services (modulos services)
 *    Punto de entrada a datos y acciones. Coordinan llamadas a la capa
 *    generada y a los flujos de Power Automate (Logic Apps).
 *
 * 4. Mappers (modulos mappers)
 *    Transforman registros crudos de Dataverse en tipos de dominio legibles
 *    para la UI. Aquí vive la lógica de negocio de transformación.
 *
 * 5. Generated (src/generated)
 *    Servicios y modelos autogenerados por Power Apps CLI. No editar a mano.
 *
 * Modulos de negocio:
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
