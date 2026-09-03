/**
 * Validación y sanitización de entradas de usuario.
 * Permite letras con tildes, guiones y puntuación académica básica;
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

/** Word únicamente (guía instruccional del asesor pedagógico). */
export const WORD_FILE_TYPES = ".doc,.docx";

export const WORD_FILE_EXTENSIONS = new Set([".doc", ".docx"]);

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

/** Títulos / nombres: solo letras (con tildes), números, espacios y guiones. */
const TITLE_ALLOWED = /^[\p{L}\p{N}\s\-]+$/u;

/** Descripciones / comentarios: igual + comillas, saltos de línea y signos frecuentes. */
const DESCRIPTION_ALLOWED = /^[\p{L}\p{N}\s\-_.:,;()/&°'"¿¡+#\n\r!?*%@]+$/u;

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
      message: `${label} contiene caracteres no permitidos. Se permiten letras, tildes, números y guiones.`,
      value,
    };
  }

  return { ok: true, value };
};

export const validateDescription = (
  raw: string,
  options?: { required?: boolean; label?: string; maxLength?: number },
): ValidationResult => {
  const label = options?.label ?? "Este campo";
  const required = options?.required ?? false;
  const maxLength = options?.maxLength ?? FIELD_LIMITS.description;
  const value = collapseMultiline(normalizeInput(raw, { multiline: true }));

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

  if (containsDangerousContent(value) || !DESCRIPTION_ALLOWED.test(value)) {
    return {
      ok: false,
      message: `${label} contiene caracteres no permitidos. Se permiten letras, tildes, números, guiones, comillas y puntuación habitual.`,
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
        message: "Debes seleccionar al menos un archivo.",
        files: [],
      };
    }
    return { ok: true, files: [] };
  }

  if (files.length > maxFiles) {
    return {
      ok: false,
      message: `Puedes subir como máximo ${maxFiles} archivos.`,
      files,
    };
  }

  for (const file of files) {
    const extension = getFileExtension(file.name);

    if (!extension || !allowedExtensions.has(extension)) {
      const wordOnly =
        allowedExtensions === WORD_FILE_EXTENSIONS ||
        (allowedExtensions.size === 2 &&
          allowedExtensions.has(".doc") &&
          allowedExtensions.has(".docx"));
      return {
        ok: false,
        message: wordOnly
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
  options?: { required?: boolean; label?: string },
): string => {
  const result = validateDescription(raw, {
    required: options?.required ?? false,
    label: options?.label ?? "Este campo",
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

/** Guía instruccional del asesor: un único Word obligatorio. */
export const assertSafeWordGuide = (files: File[]): File[] =>
  assertSafeFiles(files, {
    required: true,
    maxFiles: 1,
    allowedExtensions: WORD_FILE_EXTENSIONS,
  });
