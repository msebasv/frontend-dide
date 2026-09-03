/**
 * Definición de rutas de la aplicación.
 *
 * Todas las rutas comparten el Layout (sidebar + navbar).
 * El acceso por rol se controla en sidebarConfig y en cada página/hook.
 *
 * Convención de rutas:
 * - /my-courses, /courses/:id     → flujo de participantes (autor, validador, asesor)
 * - /virtualization-processes/*   → gestión global (solo líder)
 * - /history, /statistics       → auditoría y analítica
 */
import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./home/pages/home";
import Layout from "./global/layout/layout";
import VirtualizationProcessList from "./processVirtualization/pages/virtualizationProcessList";
import CreateProcess from "./processVirtualization/pages/createProcess";
import CreateCourse from "./processVirtualization/pages/createCourse";
import EditProcess from "./processVirtualization/pages/editProcess";
import ViewProcess from "./processVirtualization/pages/viewProcess";
import CourseList from "./courses/pages/courseList";
import UploadCourse from "./courses/pages/uploadCourse";
import ViewCourse from "./courses/pages/viewCourse";
import History from "./history/pages/history";
import Statistics from "./statistics/pages/statistics";
import ProcessTrackingPage from "./tracking/pages/processTracking";
import AdminProgramsPage from "./admin/pages/adminPrograms";
import AdminLeaderUsersPage from "./admin/pages/adminLeaderUsers";
import AdminPeoplePage from "./admin/pages/adminPeople";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Panel de inicio — dashboard según rol activo */}
        <Route path="/" element={<Home />} />

        {/* Auditoría: lista de procesos → detalle de actividades */}
        <Route path="/history" element={<History />} />
        <Route path="/history/:processId" element={<History />} />

        {/* Analítica — líder; seguimiento también asesor */}
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/tracking" element={<ProcessTrackingPage />} />

        {/* Flujo de participantes del proceso */}
        <Route path="/my-courses" element={<CourseList />} />
        <Route path="/courses/:processId/upload" element={<UploadCourse />} />
        <Route
          path="/courses/:processId/validate"
          element={<Navigate to=".." replace />}
        />
        <Route path="/courses/:processId" element={<ViewCourse />} />

        {/* Gestión global — líder / coordinador DIDE / administrador */}
        <Route
          path="/virtualization-processes"
          element={<VirtualizationProcessList />}
        />
        <Route
          path="/virtualization-processes/create"
          element={<CreateProcess />}
        />
        <Route
          path="/virtualization-processes/create-course"
          element={<CreateCourse />}
        />
        <Route
          path="/virtualization-processes/:processId/edit"
          element={<EditProcess />}
        />
        <Route
          path="/virtualization-processes/:processId"
          element={<ViewProcess />}
        />

        {/* Administración */}
        <Route path="/admin/people" element={<AdminPeoplePage />} />
        <Route path="/admin/programs" element={<AdminProgramsPage />} />
        <Route path="/admin/leader-users" element={<AdminLeaderUsersPage />} />

        {/* Fallback: rutas no reconocidas vuelven al inicio */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
