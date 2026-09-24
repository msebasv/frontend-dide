/**
 * Validación y sanitización de entradas de usuario.
 * Permite letras con tildes, números y puntuación académica básica;
 * bloquea scripts, HTML y caracteres de control.
 */

export const FIELD_LIMITS = {
  title: 200,
  description: 2000,
  email: 254,
  fileName: 180,
  maxFiles: 10,
  maxFileBytes: 25 * 1024 * 1024,
} as const;

export const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt";

/** Word únicamente (histórico). Preferir GUIDE_FILE_* para guión. */
export const WORD_FILE_TYPES = ".doc,.docx";

export const WORD_FILE_EXTENSIONS = new Set([".doc", ".docx"]);

/** Guión instruccional: Word o PDF. */
export const GUIDE_FILE_TYPES = ".doc,.docx,.pdf";

export const GUIDE_FILE_EXTENSIONS = new Set([".doc", ".docx", ".pdf"]);

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
]);

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WEIRD_SPACES = /[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;
const DANGEROUS_CHARS = /[<>{}[\]`\\]/;

const DANGEROUS_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /<\s*\/\s*script\s*>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /\bon\w+\s*=/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*link\b/i,
  /<\s*meta\b/i,
  /<\s*svg\b/i,
  /&#x?[0-9a-f]+/i,
  /%3c/i,
];

/** Títulos / nombres: letras, números, espacios y puntuación (sin / ni guiones tipográficos – —). */
const TITLE_ALLOWED = /^[\p{L}\p{N}\s\-_.:,;()&°'"¿¡+#!?*%@]+$/u;

/** Descripciones / comentarios: igual + saltos de línea (sin / ni guiones tipográficos – —). */
const DESCRIPTION_ALLOWED = /^[\p{L}\p{N}\s\-_.:,;()&°'"¿¡+#\n\r!?*%@]+$/u;

/** Observaciones con URLs en texto plano (permite / ? = & # %). */
const DESCRIPTION_WITH_URLS_ALLOWED =
  /^[\p{L}\p{N}\s\-_.:,;()&°'"¿¡+#\n\r!?*%@/=?#&%]+$/u;

const normalizePlainMultiline = (value: string): string =>
  value
    .replace(CONTROL_CHARS, "")
    .replace(WEIRD_SPACES, " ")
    .replace(/[\u2013\u2014\u2212]/g, "-");

export interface ValidationResult {
  ok: boolean;
  message?: string;
  value: string;
}

export interface FilesValidationResult {
  ok: boolean;
  message?: string;
  files: File[];
}

/** Escapa comillas simples para filtros OData. */
export const escapeODataString = (value: string): string =>
  value.replace(/'/g, "''");

export const normalizeInput = (
  value: string,
  options?: { multiline?: boolean },
): string => {
  let next = value.replace(CONTROL_CHARS, "").replace(WEIRD_SPACES, " ");

  // Quita guiones tipográficos (– — −) y barras /.
  next = next.replace(/[\u2013\u2014\u2212/]/g, " ");

  if (!options?.multiline) {
    next = next.replace(/[\n\r]/g, " ");
  }

  return next;
};

export const containsDangerousContent = (value: string): boolean =>
  DANGEROUS_PATTERNS.some((pattern) => pattern.test(value)) ||
  DANGEROUS_CHARS.test(value) ||
  HTML_TAG.test(value);

const collapseSpaces = (value: string): string =>
  value.trim().replace(/[ \t]+/g, " ");

const collapseMultiline = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const validateTitle = (
  raw: string,
  options?: { required?: boolean; label?: string; maxLength?: number },
): ValidationResult => {
  const label = options?.label ?? "Este campo";
  const required = options?.required ?? true;
  const maxLength = options?.maxLength ?? FIELD_LIMITS.title;
  const value = collapseSpaces(normalizeInput(raw));

  if (!value) {
    if (required) {
      return { ok: false, message: `${label} es obligatorio.`, value: "" };
    }
    return { ok: true, value: "" };
  }

  if (value.length > maxLength) {
    return {
      ok: false,
      message: `${label} no puede superar ${maxLength} caracteres.`,
      value,
    };
  }

  if (containsDangerousContent(value) || !TITLE_ALLOWED.test(value)) {
    return {
      ok: false,
      message: `${label} contiene caracteres no permitidos. Se permiten letras, tildes, números y puntuación habitual.`,
      value,
    };
  }

  return { ok: true, value };
};

export const validateDescription = (
  raw: string,
  options?: {
    required?: boolean;
    label?: string;
    maxLength?: number;
    /** Permite URLs en texto plano (diseñador DIDE). */
    allowUrls?: boolean;
  },
): ValidationResult => {
  const label = options?.label ?? "Este campo";
  const required = options?.required ?? false;
  const maxLength = options?.maxLength ?? FIELD_LIMITS.description;
  const value = collapseMultiline(
    options?.allowUrls
      ? normalizePlainMultiline(raw)
      : normalizeInput(raw, { multiline: true }),
  );

  if (!value) {
    if (required) {
      return { ok: false, message: `${label} es obligatorio.`, value: "" };
    }
    return { ok: true, value: "" };
  }

  if (value.length > maxLength) {
    return {
      ok: false,
      message: `${label} no puede superar ${maxLength} caracteres.`,
      value,
    };
  }

  const allowed = options?.allowUrls
    ? DESCRIPTION_WITH_URLS_ALLOWED
    : DESCRIPTION_ALLOWED;

  // Con URLs solo bloqueamos HTML/scripts; no caracteres tipicos de enlace.
  const unsafe = options?.allowUrls
    ? HTML_TAG.test(value) ||
      DANGEROUS_PATTERNS.some((pattern) => pattern.test(value))
    : containsDangerousContent(value);

  if (unsafe || !allowed.test(value)) {
    return {
      ok: false,
      message: options?.allowUrls
        ? `${label} contiene caracteres no permitidos.`
        : `${label} contiene caracteres no permitidos. Se permiten letras, tildes, números, guiones, comillas y puntuación habitual.`,
      value,
    };
  }

  return { ok: true, value };
};

export const validateOrganizationEmail = (raw: string): ValidationResult => {
  const value = normalizeInput(raw).trim().toLowerCase();

  if (!value) {
    return { ok: false, message: "El correo es obligatorio.", value: "" };
  }

  if (value.length > FIELD_LIMITS.email) {
    return {
      ok: false,
      message: "El correo supera la longitud máxima permitida.",
      value,
    };
  }

  if (containsDangerousContent(value)) {
    return {
      ok: false,
      message: "El correo contiene caracteres no permitidos.",
      value,
    };
  }

  if (!/^[a-z0-9._%+-]+@unbosque\.edu\.co$/i.test(value)) {
    return {
      ok: false,
      message: "Usa un correo institucional válido @unbosque.edu.co.",
      value,
    };
  }

  return { ok: true, value };
};

const getFileExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName.slice(lastDot).toLowerCase();
};

/** Nombre de archivo seguro para subida (sin rutas ni caracteres peligrosos). */
export const sanitizeFileName = (fileName: string): string => {
  const base = fileName.split(/[/\\]/).pop() ?? "archivo";
  const cleaned = normalizeInput(base)
    .replace(/[<>:"|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "archivo";
  return cleaned.slice(0, FIELD_LIMITS.fileName);
};

export const validateFiles = (
  files: File[],
  options?: {
    required?: boolean;
    maxFiles?: number;
    /** Si se indica, solo se aceptan estas extensiones (p. ej. Word). */
    allowedExtensions?: Set<string>;
  },
): FilesValidationResult => {
  const required = options?.required ?? false;
  const maxFiles = options?.maxFiles ?? FIELD_LIMITS.maxFiles;
  const allowedExtensions =
    options?.allowedExtensions ?? ALLOWED_FILE_EXTENSIONS;

  if (files.length === 0) {
    if (required) {
      return {
        ok: false,
        message: "Debe seleccionar al menos un archivo.",
        files: [],
      };
    }
    return { ok: true, files: [] };
  }

  if (files.length > maxFiles) {
    return {
      ok: false,
      message: `Puede cargar como máximo ${maxFiles} archivos.`,
      files,
    };
  }

  for (const file of files) {
    const extension = getFileExtension(file.name);

    if (!extension || !allowedExtensions.has(extension)) {
      const guideOnly =
        allowedExtensions === GUIDE_FILE_EXTENSIONS ||
        (allowedExtensions.size === 3 &&
          allowedExtensions.has(".doc") &&
          allowedExtensions.has(".docx") &&
          allowedExtensions.has(".pdf"));
      const wordOnly =
        allowedExtensions === WORD_FILE_EXTENSIONS ||
        (allowedExtensions.size === 2 &&
          allowedExtensions.has(".doc") &&
          allowedExtensions.has(".docx"));
      return {
        ok: false,
        message: guideOnly
          ? `El archivo "${file.name}" debe ser Word (.doc, .docx) o PDF.`
          : wordOnly
            ? `El archivo "${file.name}" debe ser Word (.doc o .docx).`
            : `El archivo "${file.name}" no es un tipo permitido. Usa PDF, Office o imágenes.`,
        files,
      };
    }

    if (file.size <= 0) {
      return {
        ok: false,
        message: `El archivo "${file.name}" está vacío.`,
        files,
      };
    }

    if (file.size > FIELD_LIMITS.maxFileBytes) {
      return {
        ok: false,
        message: `El archivo "${file.name}" supera el límite de 25 MB.`,
        files,
      };
    }

    if (containsDangerousContent(file.name) || /[<>:"|?*]/.test(file.name)) {
      return {
        ok: false,
        message: `El nombre del archivo "${file.name}" contiene caracteres no permitidos.`,
        files,
      };
    }
  }

  return { ok: true, files };
};

/** Lanza si el texto no es seguro; devuelve el valor normalizado. */
export const assertSafeTitle = (
  raw: string,
  label = "Este campo",
): string => {
  const result = validateTitle(raw, { label, required: true });
  if (!result.ok) throw new Error(result.message);
  return result.value;
};

export const assertSafeDescription = (
  raw: string,
  options?: { required?: boolean; label?: string; allowUrls?: boolean },
): string => {
  const result = validateDescription(raw, {
    required: options?.required ?? false,
    label: options?.label ?? "Este campo",
    allowUrls: options?.allowUrls,
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
};

export const assertSafeFiles = (
  files: File[],
  options?: {
    required?: boolean;
    maxFiles?: number;
    allowedExtensions?: Set<string>;
  },
): File[] => {
  const result = validateFiles(files, options);
  if (!result.ok) throw new Error(result.message);
  return result.files;
};

/** Guión instruccional del asesor: un único Word o PDF obligatorio. */
export const assertSafeWordGuide = (files: File[]): File[] =>
  assertSafeFiles(files, {
    required: true,
    maxFiles: 1,
    allowedExtensions: GUIDE_FILE_EXTENSIONS,
  });

const HTTP_URL_PATTERN =
  /^https?:\/\/[^\s<>"'`{}|\\^[\]]+$/i;

/**
 * Normaliza URLs sin romper barras ni query strings.
 * (normalizeInput genérico elimina `/`, incompatible con enlaces.)
 */
const normalizeUrlInput = (value: string): string =>
  value
    .replace(CONTROL_CHARS, "")
    .replace(WEIRD_SPACES, " ")
    .replace(/[\n\r]/g, "")
    .trim();

/** Valida un enlace http(s) individual. */
export const validateHttpUrl = (
  raw: string,
  options?: { required?: boolean; label?: string },
): ValidationResult => {
  const label = options?.label ?? "El enlace";
  const required = options?.required ?? false;
  const value = normalizeUrlInput(raw);

  if (!value) {
    if (required) {
      return { ok: false, message: `${label} es obligatorio.`, value: "" };
    }
    return { ok: true, value: "" };
  }

  if (value.length > 2000) {
    return {
      ok: false,
      message: `${label} es demasiado largo.`,
      value,
    };
  }

  // Solo bloqueamos HTML/scripts claros; las URLs necesitan : / ? & = #.
  const hasHtmlOrScript =
    HTML_TAG.test(value) ||
    DANGEROUS_PATTERNS.some((pattern) => pattern.test(value));

  if (hasHtmlOrScript || !HTTP_URL_PATTERN.test(value)) {
    return {
      ok: false,
      message: `${label} debe ser una URL válida que empiece por http:// o https://.`,
      value,
    };
  }

  return { ok: true, value };
};

/**
 * Valida la lista de enlaces audiovisuales del Diseñador DIDE.
 * Exige al menos un enlace http(s) válido.
 */
export const validateAudiovisualLinks = (
  rawLinks: string[],
): { ok: true; links: string[] } | { ok: false; message: string; links: string[] } => {
  const trimmed = rawLinks.map((link) => normalizeUrlInput(link));
  const nonEmpty = trimmed.filter(Boolean);

  if (nonEmpty.length === 0) {
    return {
      ok: false,
      message: "Debe registrar al menos un enlace audiovisual.",
      links: [],
    };
  }

  if (nonEmpty.length > 20) {
    return {
      ok: false,
      message: "Puede registrar un máximo de 20 enlaces.",
      links: nonEmpty,
    };
  }

  for (let index = 0; index < nonEmpty.length; index += 1) {
    const link = nonEmpty[index] ?? "";
    const check = validateHttpUrl(link, {
      required: true,
      label: `El enlace ${index + 1}`,
    });
    if (!check.ok) {
      return {
        ok: false,
        message: check.message ?? `El enlace ${index + 1} no es válido.`,
        links: nonEmpty,
      };
    }
  }

  return { ok: true, links: nonEmpty };
};

/**
 * Extrae enlaces http(s) desde documents u observations de una actividad
 * (JSON `["https://...", ...]` registrado por el diseñador DIDE).
 */
export const parseAudiovisualLinksFromDocuments = (
  documents: string | undefined | null,
): string[] => {
  let raw = (documents ?? "").trim();
  if (!raw) return [];

  // Si vino con escapes del flujo (`[\"https://...\"]`), normalizar antes de parsear.
  if (raw.includes('\\"') && !raw.includes('["')) {
    raw = raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item ?? "").trim())
        .filter((link) => /^https?:\/\//i.test(link));
    }
    if (typeof parsed === "string") {
      const nested = parseAudiovisualLinksFromDocuments(parsed);
      if (nested.length > 0) return nested;
      if (/^https?:\/\//i.test(parsed.trim())) return [parsed.trim()];
    }
  } catch {
    if (/^https?:\/\//i.test(raw)) return [raw];
  }

  return [];
};

const HTTP_URL_IN_TEXT =
  /https?:\/\/[^\s<>"'\)\]]+/gi;

/**
 * Extrae URLs desde texto plano (observaciones del diseñador) o JSON legacy.
 */
export const extractHttpLinksFromText = (
  value: string | undefined | null,
): string[] => {
  const raw = (value ?? "").trim();
  if (!raw) return [];

  const fromJson = parseAudiovisualLinksFromDocuments(raw);
  if (fromJson.length > 0) return [...new Set(fromJson)];

  const matches = raw.match(HTTP_URL_IN_TEXT) ?? [];
  return [
    ...new Set(
      matches
        .map((link) => link.replace(/[.,;:!?)]+$/g, "").trim())
        .filter(Boolean),
    ),
  ];
};

/**
 * Quita las URLs del texto para dejar solo notas / comentarios.
 * También elimina etiquetas vacías tipo "Link1:" / "Enlace 2:" que quedan
 * cuando el diseñador solo pegó URLs bajo esos rótulos.
 */
export const stripHttpLinksFromText = (
  value: string | undefined | null,
): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (parseAudiovisualLinksFromDocuments(raw).length > 0) return "";

  return raw
    .replace(HTTP_URL_IN_TEXT, " ")
    .replace(/(?:^|\n)\s*(?:link|enlace|url)\s*\d*\s*:\s*(?=\n|$)/gi, "\n")
    .replace(/^[ \t]*(?:link|enlace|url)\s*\d*\s*:\s*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

/**
 * Devuelve los enlaces como texto JSON del array, con comillas escapadas.
 * El flujo Power Automate concatena `observations` dentro de un `json('...')`;
 * si mandamos `["https://..."]` crudo, el parseo falla. Hay que enviar:
 * `[\"https://...\"]` para que el objeto compuesto quede válido y
 * `activity.observations` sea el string `["https://..."]`.
 */
export const assertSafeAudiovisualLinksJson = (rawLinks: string[]): string => {
  const result = validateAudiovisualLinks(rawLinks);
  if (!result.ok) throw new Error(result.message);
  return JSON.stringify(result.links).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};
