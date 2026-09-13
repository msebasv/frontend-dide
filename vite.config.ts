import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: obligatorio para que assets (logos, JS, CSS) carguen en Power Apps
  base: "./",
  plugins: [react(), powerApps(), tailwindcss()],
  build: {
    // Incrusta PNGs pequeños en el bundle (evita 404 de import.meta.url en el host)
    assetsInlineLimit: 120_000,
  },
});
