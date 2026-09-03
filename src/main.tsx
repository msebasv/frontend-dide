/**
 * Punto de entrada de AcademicPlus.
 *
 * Monta la app React dentro del host de Power Apps con:
 * - HashRouter: requerido porque Power Apps sirve la app en un iframe con URL dinámica.
 * - AuthProvider: carga perfil y roles antes de renderizar rutas protegidas por rol.
 *
 * @see src/global/constants/architecture.ts para la documentación completa de capas.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { HashRouter } from "react-router-dom";
import AuthProvider from "./global/providers/authProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
