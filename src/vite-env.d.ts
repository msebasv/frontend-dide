/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHAREPOINT_SITE_URL: string;
  readonly VITE_SHAREPOINT_LIBRARY?: string;
  readonly VITE_SHAREPOINT_FORMATS_FOLDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
