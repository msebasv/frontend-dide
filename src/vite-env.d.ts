/** Tipos de variables de entorno expuestas por Vite. */
/// <reference types="vite/client" />

/**
 * Tipado de variables Vite (`import.meta.env`) para SharePoint.
 * Valores reales en `.env.local` (ver `.env.example`).
 */
interface ImportMetaEnv {
  /** URL del sitio SharePoint del ambiente activo. */
  readonly VITE_SHAREPOINT_SITE_URL: string;
  /** Biblioteca de documentos (opcional). */
  readonly VITE_SHAREPOINT_LIBRARY?: string;
  /** Carpeta de formatos dentro de la biblioteca (opcional). */
  readonly VITE_SHAREPOINT_FORMATS_FOLDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
