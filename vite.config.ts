import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";
import tailwindcss from "@tailwindcss/vite";

/** Sitio SharePoint del ambiente activo en power.config.json. */
const sharePointSiteFromPowerConfig = (): string => {
  try {
    const config = JSON.parse(readFileSync("power.config.json", "utf8")) as {
      connectionReferences?: Record<
        string,
        { id?: string; dataSets?: Record<string, unknown> }
      >;
    };
    for (const reference of Object.values(config.connectionReferences ?? {})) {
      if (!reference?.id?.toLowerCase().includes("sharepointonline")) continue;
      const site = Object.keys(reference.dataSets ?? {})[0];
      if (site) return site.replace(/\/+$/, "");
    }
  } catch {
    // Sin config, la pantalla de archivos usa la variable de entorno si existe.
  }
  return "";
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sharePointSite =
    env.VITE_SHAREPOINT_SITE_URL?.replace(/\/+$/, "") ||
    sharePointSiteFromPowerConfig();

  return {
    // Rutas relativas: obligatorio para que assets (logos, JS, CSS) carguen en Power Apps
    base: "./",
    plugins: [react(), powerApps(), tailwindcss()],
    define: {
      "import.meta.env.VITE_SHAREPOINT_SITE_URL": JSON.stringify(sharePointSite),
    },
    build: {
      // Incrusta PNGs pequeños en el bundle (evita 404 de import.meta.url en el host)
      assetsInlineLimit: 120_000,
    },
  };
});
