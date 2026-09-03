import { DocumentsService } from "../../generated/services/DocumentsService";
import type { DocumentsRead } from "../../generated/models/DocumentsModel";
import { SharePointOnlineService } from "../../generated/services/SharePointOnlineService";
import type { SharePointBlobItem } from "../../generated/services/SharePointOnlineService";
import {
  buildServerRelativePath,
  resolveSharePointFolder,
  sharepointConfig,
} from "../../global/config/sharepointConfig";
import {
  getUserFriendlySharePointMessage,
  isSharePointNotFoundError,
} from "../errors/sharePointSetupError";
import type { ProcessFile } from "../types/course.types";

const LIBRARY_CANDIDATES = [
  sharepointConfig.defaultLibrary,
  "Shared Documents",
  "Documentos compartidos",
  "Documents",
  "691335fc-2161-4ee3-b307-6f51481425dc",
];

const isFolderItem = (item: SharePointBlobItem): boolean => {
  if (item.IsFolder === true || item["{IsFolder}"] === true) return true;
  if (item.FSObjType === 1) return true;

  const contentType = (item as Record<string, unknown>).ContentType;
  if (typeof contentType === "string" && contentType.toLowerCase().includes("folder")) {
    return true;
  }

  return false;
};

const getItemName = (item: SharePointBlobItem, fallbackPath = ""): string => {
  const record = item as Record<string, unknown>;
  const candidates = [
    item["{FilenameWithExtension}"],
    item.FileLeafRef,
    item.Name,
    item.DisplayName,
    record.LinkFilename,
    record.Title,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallbackPath.split("/").filter(Boolean).pop() ?? "Archivo sin nombre";
};

const getItemPath = (item: SharePointBlobItem): string =>
  item.Path ??
  item["{Path}"] ??
  item.FileRef ??
  "";

const getItemId = (item: SharePointBlobItem): string | undefined => {
  const record = item as Record<string, unknown>;
  const identifier =
    item["{Identifier}"] ??
    record.Identifier ??
    record.UniqueId ??
    record.uniqueId;

  if (typeof identifier === "string" && identifier.trim()) {
    return identifier.trim();
  }

  if (item.Id != null && typeof item.Id === "string" && item.Id.includes("-")) {
    return item.Id;
  }

  return item.Id != null ? String(item.Id) : undefined;
};

const getItemLink = (item: SharePointBlobItem): string | undefined =>
  item.Link ?? item["{Link}"];

const parseItemsArray = (raw: unknown, depth = 0): SharePointBlobItem[] => {
  if (!raw || depth > 4) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string") {
    try {
      return parseItemsArray(JSON.parse(raw), depth + 1);
    } catch {
      return [];
    }
  }

  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;

    for (const key of ["value", "items", "results", "body", "data"]) {
      const nested = record[key];
      const parsed = parseItemsArray(nested, depth + 1);
      if (parsed.length > 0) return parsed;
    }
  }

  return [];
};

const getFolderId = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== "object") return undefined;

  const record = raw as Record<string, unknown>;
  const id =
    record.Id ??
    record.id ??
    record.ItemId ??
    record["{Identifier}"] ??
    record.Identifier;

  return id != null ? String(id) : undefined;
};

const uniqueStrings = (values: string[]): string[] =>
  values.filter((value, index, array) => value && array.indexOf(value) === index);

const encodePathSegments = (path: string): string =>
  path
    .split("/")
    .map((segment) => (segment ? encodeURIComponent(segment) : ""))
    .join("/");

const getFolderToken = (folderBase: string, processId?: string): string => {
  const trimmed = folderBase.trim();
  const lastSegment = trimmed.split("/").filter(Boolean).pop() ?? trimmed;

  if (lastSegment.startsWith("proceso-")) return lastSegment;
  if (processId) return `proceso-${processId}`;

  return lastSegment;
};

const buildGetFileItemsFolderPaths = (
  library: string,
  folderPath: string,
  folderBase: string,
  folderToken: string,
): string[] =>
  uniqueStrings([
    folderPath,
    folderToken,
    `${library}/${folderPath}`,
    `${library}/${folderToken}`,
    `/${library}/${folderPath}`,
    `/${library}/${folderToken}`,
    folderBase.trim().replace(/^\/+/, ""),
    `/${folderBase.trim().replace(/^\/+/, "")}`,
  ]);

const buildMetadataPaths = (
  siteUrl: string,
  library: string,
  folderPath: string,
  folderToken: string,
  folderBase: string,
): string[] => {
  const serverFolderPath = buildServerRelativePath(siteUrl, library, folderPath);
  const serverTokenPath = buildServerRelativePath(siteUrl, library, folderToken);

  return uniqueStrings([
    serverFolderPath,
    serverFolderPath.startsWith("/") ? serverFolderPath : `/${serverFolderPath}`,
    serverTokenPath,
    serverTokenPath.startsWith("/") ? serverTokenPath : `/${serverTokenPath}`,
    `/${library}/${folderPath}`,
    `/${library}/${folderToken}`,
    folderBase.trim().replace(/^\/+/, "").startsWith("/")
      ? folderBase.trim()
      : `/${folderBase.trim().replace(/^\/+/, "")}`,
    encodePathSegments(
      serverFolderPath.startsWith("/") ? serverFolderPath : `/${serverFolderPath}`,
    ),
  ]);
};

const mapSharePointItems = (
  items: SharePointBlobItem[],
  siteUrl: string,
  library: string,
  folderPath: string,
): ProcessFile[] =>
  items
    .filter((item) => !isFolderItem(item))
    .map((item) => {
      const path = getItemPath(item);
      const name = getItemName(item, path);
      const previewUrl = getItemLink(item);
      const serverPath = toServerRelativeFilePath(
        path ||
          (name
            ? buildServerRelativePath(siteUrl, library, `${folderPath}/${name}`)
            : ""),
        name,
        siteUrl,
      );
      const connectorPath =
        pathFromSharePointLink(previewUrl, siteUrl, name) ||
        toConnectorFilePath(serverPath, folderPath, name, siteUrl);

      return {
        name,
        path: serverPath,
        connectorPath,
        previewUrl,
        siteUrl,
        // Solo Identifier nativo de SharePoint (no fabricar rutas codificadas).
        fileId: item["{Identifier}"] || getItemId(item),
      };
    })
    .filter((file) => file.name && file.name !== "Archivo sin nombre");

const itemMatchesFolderToken = (
  item: SharePointBlobItem,
  folderToken: string,
): boolean => {
  const path = getItemPath(item).toLowerCase();
  const token = folderToken.toLowerCase();

  return path.includes(`/${token}/`) || path.endsWith(`/${token}`);
};

const getOperationErrorMessage = (
  result: { success?: boolean; error?: unknown },
  operation: string,
): string | undefined => {
  if (result.success !== false && !result.error) return undefined;

  if (result.error instanceof Error) return result.error.message;

  if (
    typeof result.error === "object" &&
    result.error &&
    "message" in result.error
  ) {
    return String((result.error as { message?: string }).message);
  }

  return `${operation} falló`;
};

const resolveProcessFilePath = (rawPath: string, fileName: string): string => {
  const trimmedName = fileName.trim();
  const trimmedPath = rawPath.trim().replace(/\/+$/, "");

  if (!trimmedName) return trimmedPath;
  if (!trimmedPath) return trimmedName;

  const pathLower = trimmedPath.toLowerCase();
  const nameLower = trimmedName.toLowerCase();

  // Solo considerar que ya incluye el archivo si el último segmento es el nombre.
  const lastSegment = trimmedPath.split("/").filter(Boolean).pop()?.toLowerCase();
  if (lastSegment === nameLower) {
    return trimmedPath;
  }

  if (pathLower.endsWith(`/${nameLower}`)) {
    return trimmedPath;
  }

  return `${trimmedPath}/${trimmedName}`.replace(/\/{2,}/g, "/");
};

/** True si la ruta termina en el nombre del archivo (no es carpeta). */
const pathEndsWithFileName = (path: string, fileName: string): boolean => {
  const trimmedName = fileName.trim().toLowerCase();
  if (!trimmedName || !path.trim()) return false;

  const lastSegment = path
    .trim()
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.toLowerCase();

  return lastSegment === trimmedName;
};

/**
 * Extrae ruta relativa al sitio desde un enlace de SharePoint
 * (p. ej. /Shared Documents/proceso-.../archivo.pdf).
 */
const pathFromSharePointLink = (
  link: string | undefined,
  siteUrl: string,
  fileName: string,
): string => {
  if (!link?.trim()) return "";

  try {
    const url = new URL(link);
    // Enlaces tipo /:b:/r/sites/.../Shared Documents/archivo.pdf
    let pathname = decodeURIComponent(url.pathname);
    pathname = pathname.replace(/^\/:[a-z]:\/[rs]\//i, "/");

    const stripped = stripSitePrefixFromPath(pathname, siteUrl);
    if (!stripped || stripped === "/") return "";

    // Solo útil si apunta al archivo (o a su carpeta, y entonces anexamos el nombre).
    if (pathEndsWithFileName(stripped, fileName)) return stripped;

    // Si el link es a la carpeta del archivo, anexar nombre.
    if (fileName && !stripped.toLowerCase().includes(".")) {
      return resolveProcessFilePath(stripped, fileName);
    }

    return resolveProcessFilePath(stripped, fileName);
  } catch {
    return "";
  }
};

const toServerRelativeFilePath = (
  rawPath: string,
  fileName: string,
  siteUrl: string,
): string => {
  const resolved = resolveProcessFilePath(rawPath, fileName);

  if (resolved.startsWith("/sites/")) {
    return resolved.startsWith("/") ? resolved : `/${resolved}`;
  }

  const sitePathname = new URL(siteUrl).pathname.replace(/\/+$/, "");
  const normalized = resolved.replace(/^\/+/, "");

  return `${sitePathname}/${normalized}`.replace(/\/{2,}/g, "/");
};

const stripSitePrefixFromPath = (path: string, siteUrl: string): string => {
  const trimmed = path.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const sitesIndex = parts.indexOf("sites");

    if (sitesIndex >= 0 && parts.length > sitesIndex + 2) {
      return `/${parts.slice(sitesIndex + 2).join("/")}`;
    }

    return url.pathname;
  }

  const sitePathname = new URL(siteUrl).pathname.replace(/\/+$/, "");
  const normalized = trimmed.replace(/^\/+/, "");
  const sitePrefix = sitePathname.replace(/^\/+/, "");

  if (normalized.startsWith(sitePrefix)) {
    const withoutSite = normalized.slice(sitePrefix.length).replace(/^\/+/, "");
    return withoutSite ? `/${withoutSite}` : "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

/** En este tenant la biblioteca real es "Shared Documents" (inglés). */
const PRIMARY_LIBRARY = "Shared Documents";

const pathHasLibraryPrefix = (path: string): boolean => {
  const normalized = path.replace(/^\/+/, "").toLowerCase();
  return (
    normalized.startsWith("shared documents/") ||
    normalized.startsWith("documents/") ||
    normalized.startsWith("documentos compartidos/")
  );
};

/**
 * Normaliza a rutas válidas para GetFileContentByPath.
 * Formato esperado: /Shared Documents/proceso-.../archivo.xlsx
 */
const toGetFileByPathCandidates = (path: string): string[] => {
  const trimmed = path.trim().replace(/\/+$/, "");
  if (!trimmed) return [];

  let relative = trimmed.replace(/^\/+/, "");

  // Alias ES / otros nombres → biblioteca real del sitio.
  const libraryAliases = [
    "documentos compartidos",
    "shared documents",
    "documents",
    sharepointConfig.defaultLibrary.toLowerCase(),
  ];

  for (const alias of libraryAliases) {
    if (relative.toLowerCase().startsWith(`${alias}/`)) {
      relative = `${PRIMARY_LIBRARY}/${relative.slice(alias.length + 1)}`;
      break;
    }
    if (relative.toLowerCase() === alias) {
      relative = PRIMARY_LIBRARY;
      break;
    }
  }

  if (!relative.toLowerCase().startsWith("shared documents/")) {
    relative = `${PRIMARY_LIBRARY}/${relative}`;
  }

  return uniqueStrings([`/${relative}`, relative]);
};

const toConnectorFilePath = (
  fullPath: string,
  folderPath: string,
  fileName: string,
  siteUrl: string,
): string => {
  const trimmedName = fileName.trim();

  const fromFullPath = stripSitePrefixFromPath(fullPath, siteUrl);
  if (fromFullPath) {
    const resolved = resolveProcessFilePath(fromFullPath, trimmedName);
    return toGetFileByPathCandidates(resolved)[0] ?? `/${PRIMARY_LIBRARY}/${trimmedName}`;
  }

  const fromFolderPath = stripSitePrefixFromPath(folderPath, siteUrl);
  if (fromFolderPath) {
    const resolved = resolveProcessFilePath(fromFolderPath, trimmedName);
    return toGetFileByPathCandidates(resolved)[0] ?? `/${PRIMARY_LIBRARY}/${trimmedName}`;
  }

  return `/${PRIMARY_LIBRARY}/${trimmedName}`;
};

const buildFileContentPathCandidates = (
  file: ProcessFile,
  siteUrl: string,
): string[] => {
  const rawCandidates: string[] = [];

  // 1) Ruta guardada al listar (la más fiable).
  if (file.connectorPath) {
    rawCandidates.push(file.connectorPath);
  }

  const fromLink = pathFromSharePointLink(file.previewUrl, siteUrl, file.name);
  if (fromLink) rawCandidates.push(fromLink);

  rawCandidates.push(
    resolveProcessFilePath(
      stripSitePrefixFromPath(file.path, siteUrl),
      file.name,
    ),
    stripSitePrefixFromPath(
      resolveProcessFilePath(file.path, file.name),
      siteUrl,
    ),
  );

  return uniqueStrings(
    rawCandidates
      .flatMap((candidate) => toGetFileByPathCandidates(candidate))
      .map((candidate) => candidate.trim().replace(/\/+$/, ""))
      .filter(Boolean)
      .filter((candidate) => pathEndsWithFileName(candidate, file.name)),
  );
};

interface FileContentPayload {
  data: Blob | ArrayBuffer | Uint8Array | string;
  mimeType?: string;
}

const extractFileContentPayload = (content: unknown): FileContentPayload | null => {
  if (content instanceof Blob) {
    return { data: content };
  }

  if (content instanceof ArrayBuffer) {
    return { data: content };
  }

  if (content instanceof Uint8Array) {
    return { data: content };
  }

  if (typeof content === "string") {
    return { data: content };
  }

  if (typeof content !== "object" || content === null) {
    return null;
  }

  const record = content as Record<string, unknown>;
  const body =
    typeof record.body === "object" && record.body !== null
      ? (record.body as Record<string, unknown>)
      : undefined;

  const nestedContent =
    record.$content ??
    record.content ??
    body?.$content ??
    body?.content;

  const nestedType =
    record["$content-type"] ??
    record.contentType ??
    body?.["$content-type"];

  if (typeof nestedContent === "string") {
    return {
      data: nestedContent,
      mimeType: typeof nestedType === "string" ? nestedType : undefined,
    };
  }

  if (nestedContent instanceof ArrayBuffer) {
    return {
      data: nestedContent,
      mimeType: typeof nestedType === "string" ? nestedType : undefined,
    };
  }

  if (nestedContent instanceof Uint8Array) {
    return {
      data: nestedContent,
      mimeType: typeof nestedType === "string" ? nestedType : undefined,
    };
  }

  if (Array.isArray(nestedContent)) {
    return {
      data: new Uint8Array(nestedContent as number[]),
      mimeType: typeof nestedType === "string" ? nestedType : undefined,
    };
  }

  if (typeof record.body === "string") {
    return { data: record.body };
  }

  return null;
};

export const getProcessFileKey = (file: ProcessFile): string =>
  file.fileId?.trim() || `${file.path}::${file.name}`;

const mapDocumentLibraryItem = (
  item: DocumentsRead,
  siteUrl: string,
): ProcessFile | null => {
  if (item["{IsFolder}"] === true) return null;

  const name =
    item["{FilenameWithExtension}"] ??
    item["{Name}"] ??
    item.Title ??
    "";

  if (!name.trim()) return null;

  const trimmedName = name.trim();
  const folderPath = item["{Path}"] ?? "";
  const rawFullPath = item["{FullPath}"] ?? "";
  // Preferir FullPath/Path tal como los devuelve SharePoint.
  const fullPath = resolveProcessFilePath(
    rawFullPath || folderPath,
    trimmedName,
  );
  const connectorPath = toConnectorFilePath(
    rawFullPath || fullPath,
    folderPath,
    trimmedName,
    siteUrl,
  );
  const previewUrl = item["{Link}"];

  return {
    name: trimmedName,
    path: toServerRelativeFilePath(fullPath || folderPath, trimmedName, siteUrl),
    connectorPath,
    previewUrl,
    siteUrl,
    fileId: item["{Identifier}"],
    driveItemId: item["{DriveItemId}"],
    listItemId: item.ID,
  };
};

const listProcessFilesFromDocumentsLibrary = async (
  folderToken: string,
  siteUrl: string,
): Promise<ProcessFile[]> => {
  const folderTokenLower = folderToken.toLowerCase();

  const result = await DocumentsService.getAll({
    top: 5000,
    select: [
      "{FilenameWithExtension}",
      "{Name}",
      "{Path}",
      "{FullPath}",
      "{Link}",
      "{Identifier}",
      "{IsFolder}",
      "{DriveItemId}",
      "Title",
      "ID",
    ],
  });

  const errorMessage = getOperationErrorMessage(result, "DocumentsService.getAll");
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const allItems = result.data ?? [];

  const matchesFolder = (item: DocumentsRead): boolean => {
    const path = (item["{FullPath}"] ?? item["{Path}"] ?? "").toLowerCase();
    return (
      path.includes(`/${folderTokenLower}/`) ||
      path.includes(`/${folderTokenLower}`) ||
      path.includes(folderTokenLower)
    );
  };

  return allItems
    .filter(matchesFolder)
    .map((item) => mapDocumentLibraryItem(item, siteUrl))
    .filter((file): file is ProcessFile => file != null);
};

const assertSharePointResult = (
  result: { success?: boolean; error?: unknown },
  operation: string,
): void => {
  const message = getOperationErrorMessage(result, operation);
  if (message) throw new Error(message);
};

const listFilesFromFolderMetadata = async (
  siteUrl: string,
  metadataPath: string,
): Promise<SharePointBlobItem[]> => {
  const folderMeta = await SharePointOnlineService.GetFolderMetadataByPath({
    dataset: siteUrl,
    path: metadataPath,
  });

  assertSharePointResult(folderMeta, "GetFolderMetadataByPath");

  const folderId = getFolderId(folderMeta.data);
  if (!folderId) return [];

  const listResult = await SharePointOnlineService.ListFolder({
    dataset: siteUrl,
    id: folderId,
  });

  assertSharePointResult(listResult, "ListFolder");

  return parseItemsArray(listResult.data);
};

const listFilesFromGetFileItems = async (
  siteUrl: string,
  library: string,
  folderPath?: string,
): Promise<SharePointBlobItem[]> => {
  const viewScopeOptions = folderPath
    ? (["Default", "FilesOnly"] as const)
    : (["RecursiveAll", "Recursive"] as const);

  for (const viewScopeOption of viewScopeOptions) {
    const result = await SharePointOnlineService.GetFileItems({
      dataset: siteUrl,
      table: library,
      folderPath,
      viewScopeOption,
      $filter: "FSObjType eq 0",
      $top: 5000,
    });

    assertSharePointResult(result, "GetFileItems");

    const items = parseItemsArray(result.data);
    if (items.length > 0) return items;
  }

  return [];
};

const listFilesRecursively = async (
  siteUrl: string,
  library: string,
  folderToken: string,
): Promise<SharePointBlobItem[]> => {
  const result = await SharePointOnlineService.GetFileItems({
    dataset: siteUrl,
    table: library,
    viewScopeOption: "RecursiveAll",
    $filter: "FSObjType eq 0",
    $top: 5000,
  });

  assertSharePointResult(result, "GetFileItems");

  return parseItemsArray(result.data).filter((item) =>
    itemMatchesFolderToken(item, folderToken),
  );
};

export const listProcessFiles = async (
  folderBase: string,
  processId?: string,
  activityId?: string,
): Promise<ProcessFile[]> => {
  const trimmedFolderBase = folderBase.trim();
  const effectiveFolderBase =
    trimmedFolderBase ||
    (processId ? `proceso-${processId}` : "");

  if (!effectiveFolderBase) return [];

  const folderToken = getFolderToken(effectiveFolderBase, processId);
  const { siteUrl, library, folderPath } =
    resolveSharePointFolder(effectiveFolderBase);

  // Con estructura proceso-{id}/{activityId}/ priorizamos esa ruta.
  const activityFolderPath =
    activityId && folderToken
      ? `${folderToken}/${activityId}`
      : activityId && folderPath
        ? `${folderPath}/${activityId}`
        : "";

  let lastError: unknown;

  try {
    const documentLibraryFiles = await listProcessFilesFromDocumentsLibrary(
      folderToken,
      siteUrl,
    );
    if (documentLibraryFiles.length > 0) {
      const filtered = activityId
        ? documentLibraryFiles.filter((file) =>
            file.path.toLowerCase().includes(`/${activityId.toLowerCase()}/`),
          )
        : documentLibraryFiles;

      if (filtered.length > 0 || !activityId) {
        return filtered;
      }
    }
  } catch (error) {
    lastError = error;
  }

  const libraries = uniqueStrings([library, ...LIBRARY_CANDIDATES]);
  const getFileItemsPaths = buildGetFileItemsFolderPaths(
    library,
    activityFolderPath || folderPath,
    effectiveFolderBase,
    activityFolderPath || folderToken,
  );
  const metadataPaths = buildMetadataPaths(
    siteUrl,
    library,
    activityFolderPath || folderPath,
    activityFolderPath || folderToken,
    effectiveFolderBase,
  );

  const resolvedFolderPath = activityFolderPath || folderPath || folderToken;

  const filterByActivity = (files: ProcessFile[]): ProcessFile[] => {
    if (!activityId) return files;
    const needle = `/${activityId.toLowerCase()}`;
    return files.filter((file) => {
      const path = file.path.toLowerCase();
      return path.includes(`${needle}/`) || path.endsWith(needle);
    });
  };

  for (const libraryName of libraries) {
    for (const candidateFolderPath of getFileItemsPaths) {
      try {
        const fileItems = await listFilesFromGetFileItems(
          siteUrl,
          libraryName,
          candidateFolderPath,
        );
        const mappedFileItems = filterByActivity(
          mapSharePointItems(
            fileItems,
            siteUrl,
            libraryName,
            resolvedFolderPath,
          ),
        );

        if (mappedFileItems.length > 0) {
          return mappedFileItems;
        }
      } catch (error) {
        lastError = error;
      }
    }

    for (const metadataPath of metadataPaths) {
      try {
        const folderItems = await listFilesFromFolderMetadata(
          siteUrl,
          metadataPath,
        );
        const mappedFolderItems = filterByActivity(
          mapSharePointItems(
            folderItems,
            siteUrl,
            libraryName,
            resolvedFolderPath,
          ),
        );

        if (mappedFolderItems.length > 0) {
          return mappedFolderItems;
        }
      } catch (error) {
        lastError = error;
      }
    }

    try {
      const recursiveItems = await listFilesRecursively(
        siteUrl,
        libraryName,
        folderToken,
      );
      const mappedRecursiveItems = filterByActivity(
        mapSharePointItems(
          recursiveItems,
          siteUrl,
          libraryName,
          resolvedFolderPath,
        ),
      );

      if (mappedRecursiveItems.length > 0) {
        return mappedRecursiveItems;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    if (isSharePointNotFoundError(lastError)) {
      return [];
    }

    throw new Error(getUserFriendlySharePointMessage(lastError));
  }

  return [];
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const normalized = base64.replace(/\s/g, "");

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  } catch {
    return new Blob([base64], { type: mimeType });
  }
};

const contentToBlob = (content: unknown, mimeType: string): Blob => {
  const payload = extractFileContentPayload(content);
  if (!payload) {
    throw new Error("Formato de archivo no soportado.");
  }

  const resolvedMime = payload.mimeType ?? mimeType;
  const { data } = payload;

  if (data instanceof Blob) return data;

  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: resolvedMime });
  }

  if (data instanceof Uint8Array) {
    return new Blob([new Uint8Array(data)], { type: resolvedMime });
  }

  if (typeof data === "string") {
    if (data.startsWith("data:")) {
      const [header, base64 = ""] = data.split(",", 2);
      const detectedType = header.match(/data:(.*?);/)?.[1];
      return base64ToBlob(base64, detectedType ?? resolvedMime);
    }

    if (data.startsWith("%PDF") || data.startsWith("PK")) {
      return new Blob([data], { type: resolvedMime });
    }

    return base64ToBlob(data, resolvedMime);
  }

  throw new Error("Formato de archivo no soportado.");
};

export const guessMimeType = (fileName: string): string => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
};

const loadFileContentViaList = async (
  file: ProcessFile,
  siteUrl: string,
  mimeType: string,
): Promise<Blob | null> => {
  const fileName = file.name.trim();
  if (!fileName) return null;

  const pathWithName = resolveProcessFilePath(
    file.connectorPath || stripSitePrefixFromPath(file.path, siteUrl),
    fileName,
  );
  const connectorParts = pathWithName.split("/").filter(Boolean);

  if (connectorParts.length < 2) return null;

  const folderCandidates = uniqueStrings(
    [
      connectorParts.slice(0, -1).join("/"),
      connectorParts.slice(1, -1).join("/"),
      resolveProcessFilePath(
        stripSitePrefixFromPath(file.path, siteUrl),
        fileName,
      )
        .split("/")
        .filter(Boolean)
        .slice(0, -1)
        .join("/"),
    ]
      .flatMap((folder) => {
        const relative = folder.replace(/^\/+/, "");
        // GetFileItems folderPath suele ir sin prefijo de biblioteca.
        if (pathHasLibraryPrefix(relative)) {
          const withoutLib = relative.split("/").slice(1).join("/");
          return [withoutLib, relative, folder];
        }
        return [relative, folder];
      })
      .filter(Boolean),
  );

  for (const folderPath of folderCandidates) {
    try {
      const result = await SharePointOnlineService.GetFileItems({
        dataset: siteUrl,
        table: "691335fc-2161-4ee3-b307-6f51481425dc",
        folderPath,
        viewScopeOption: "Default",
        $top: 500,
      });

      const errorMessage = getOperationErrorMessage(result, "GetFileItems");
      if (errorMessage) {
        continue;
      }

      const items = parseItemsArray(result.data);
      const match = items.find(
        (item) => getItemName(item).toLowerCase() === fileName.toLowerCase(),
      );

      if (!match) continue;

      const itemPath = resolveProcessFilePath(
        stripSitePrefixFromPath(getItemPath(match), siteUrl) ||
          `${folderPath}/${fileName}`,
        fileName,
      );

      const identifier = match["{Identifier}"] || getItemId(match);
      if (identifier) {
        const byId = await tryGetFileContentById(
          siteUrl,
          identifier,
          mimeType,
        );
        if (byId) return byId;
      }

      for (const path of toGetFileByPathCandidates(itemPath).concat(
        toGetFileByPathCandidates(`${folderPath}/${fileName}`),
      )) {
        const byPath = await tryGetFileContentByPath(siteUrl, path, mimeType);
        if (byPath) return byPath;
      }
    } catch {
      // Intentar siguiente carpeta candidata.
    }
  }

  return null;
};

const tryGetFileContentByPath = async (
  siteUrl: string,
  path: string,
  mimeType: string,
): Promise<Blob | null> => {
  try {
    const result = await SharePointOnlineService.GetFileContentByPath({
      dataset: siteUrl,
      path,
      inferContentType: true,
    });

    const errorMessage = getOperationErrorMessage(
      result,
      "GetFileContentByPath",
    );
    if (errorMessage || result.data == null || result.data === "") {
      return null;
    }

    return contentToBlob(result.data, mimeType);
  } catch {
    return null;
  }
};

const tryGetFileContentById = async (
  siteUrl: string,
  fileId: string,
  mimeType: string,
): Promise<Blob | null> => {
  // Solo usar Identifier real de SharePoint. No fabricar rutas codificadas
  // (el runtime responde 400 Bad Request con ids inventados).
  if (!fileId.trim()) return null;

  try {
    const result = await SharePointOnlineService.GetFileContent({
      dataset: siteUrl,
      id: fileId.trim(),
      inferContentType: true,
    });

    const errorMessage = getOperationErrorMessage(result, "GetFileContent");
    if (errorMessage || result.data == null || result.data === "") {
      return null;
    }

    return contentToBlob(result.data, mimeType);
  } catch {
    return null;
  }
};

const loadFileContent = async (
  file: ProcessFile,
  siteUrl: string,
  mimeType: string,
): Promise<Blob> => {
  // 1) Identifier nativo de Documents/SharePoint (sin fabricar ids).
  if (file.fileId?.trim()) {
    const byId = await tryGetFileContentById(siteUrl, file.fileId, mimeType);
    if (byId) return byId;
  }

  // 2) GetFileContentByPath con /Shared Documents/.../archivo.ext
  const pathCandidates = buildFileContentPathCandidates(file, siteUrl);
  for (const path of pathCandidates) {
    const blob = await tryGetFileContentByPath(siteUrl, path, mimeType);
    if (blob) return blob;
  }

  // 3) Relistar carpeta (GetFileItems sí funciona) y reintentar con Id real.
  const listBlob = await loadFileContentViaList(file, siteUrl, mimeType);
  if (listBlob) return listBlob;

  throw new Error(`No se pudo obtener el contenido de "${file.name}".`);
};

export const getProcessFileBlob = async (
  file: ProcessFile,
): Promise<{ blob: Blob; fileName: string; mimeType: string }> => {
  const mimeType = guessMimeType(file.name);
  const siteUrl = file.siteUrl ?? sharepointConfig.siteUrl;

  if (!siteUrl) {
    throw new Error(
      "Configura VITE_SHAREPOINT_SITE_URL para acceder a los archivos.",
    );
  }

  const blob = await loadFileContent(file, siteUrl, mimeType);

  return {
    blob,
    fileName: file.name,
    mimeType: blob.type || mimeType,
  };
};

export const canPreviewFile = (fileName: string, mimeType?: string): boolean => {
  const type = mimeType ?? guessMimeType(fileName);
  return (
    type.startsWith("image/") ||
    type === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  );
};
