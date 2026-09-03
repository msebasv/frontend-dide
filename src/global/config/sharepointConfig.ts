export const sharepointConfig = {
  siteUrl: (import.meta.env.VITE_SHAREPOINT_SITE_URL ?? "").replace(/\/+$/, ""),
  defaultLibrary:
    import.meta.env.VITE_SHAREPOINT_LIBRARY ?? "Shared Documents",
  /** Carpeta de formatos compartidos dentro de la biblioteca Documents. */
  formatsFolder: import.meta.env.VITE_SHAREPOINT_FORMATS_FOLDER ?? "Formats",
};

export interface SharePointFolderLocation {
  siteUrl: string;
  library: string;
  folderPath: string;
}

const KNOWN_LIBRARIES = [
  "Shared Documents",
  "Documentos compartidos",
  "Documents",
];

const matchesKnownLibrary = (value: string): boolean =>
  KNOWN_LIBRARIES.some(
    (library) =>
      value === library ||
      value.startsWith(`${library}/`) ||
      value.startsWith(`/${library}/`),
  );

export const resolveSharePointFolder = (
  folderBase: string,
): SharePointFolderLocation => {
  const trimmed = folderBase.trim();
  const { siteUrl, defaultLibrary } = sharepointConfig;

  if (!siteUrl) {
    throw new Error(
      "No pudimos acceder a los archivos en este momento. Intenta de nuevo más tarde.",
    );
  }

  if (!trimmed) {
    return { siteUrl, library: defaultLibrary, folderPath: "" };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const sitesIndex = parts.indexOf("sites");

    if (sitesIndex >= 0 && parts.length > sitesIndex + 1) {
      const resolvedSiteUrl = `${url.origin}/${parts
        .slice(0, sitesIndex + 2)
        .join("/")}`;
      const afterSite = parts.slice(sitesIndex + 2).map(decodeURIComponent);

      return {
        siteUrl: resolvedSiteUrl,
        library: afterSite[0] ?? defaultLibrary,
        folderPath: afterSite.slice(1).join("/"),
      };
    }
  }

  const normalized = trimmed.replace(/^\/+/, "");
  const parts = normalized.split("/").map(decodeURIComponent);

  if (parts[0] === "sites" && parts.length > 2) {
    return {
      siteUrl,
      library: parts[2] ?? defaultLibrary,
      folderPath: parts.slice(3).join("/"),
    };
  }

  if (matchesKnownLibrary(normalized) && parts.length > 1) {
    return {
      siteUrl,
      library: parts[0] ?? defaultLibrary,
      folderPath: parts.slice(1).join("/"),
    };
  }

  if (parts.length > 1 && !parts[0].includes(".")) {
    return {
      siteUrl,
      library: parts[0] ?? defaultLibrary,
      folderPath: parts.slice(1).join("/"),
    };
  }

  return {
    siteUrl,
    library: defaultLibrary,
    folderPath: normalized,
  };
};

/**
 * URL de la carpeta Formatos en SharePoint (Documents/Formats).
 * Abre la vista de biblioteca filtrada a esa carpeta.
 */
export const buildSharePointFormatsFolderUrl = (): string | null => {
  const { siteUrl, defaultLibrary, formatsFolder } = sharepointConfig;
  if (!siteUrl || !formatsFolder.trim()) return null;

  try {
    const sitePath = new URL(siteUrl).pathname.replace(/\/+$/, "");
    const folderServerRelative = `${sitePath}/${defaultLibrary}/${formatsFolder.trim()}`.replace(
      /\/{2,}/g,
      "/",
    );

    return `${siteUrl}/${defaultLibrary}/Forms/AllItems.aspx?id=${encodeURIComponent(folderServerRelative)}`;
  } catch {
    return null;
  }
};

export const buildServerRelativePath = (
  siteUrl: string,
  library: string,
  folderPath: string,
): string => {
  const { pathname } = new URL(siteUrl);
  const base = pathname.replace(/\/+$/, "");
  const target = folderPath ? `${library}/${folderPath}` : library;

  return `${base}/${target}`.replace(/\/{2,}/g, "/");
};
