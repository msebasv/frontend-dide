/**
 * Mensajes y utilidades de error de SharePoint orientados al usuario final.
 * Los detalles técnicos se dejan solo en consola.
 */

export class SharePointSetupError extends Error {
  constructor(message = SharePointSetupError.defaultMessage()) {
    super(message);
    this.name = "SharePointSetupError";
  }

  static defaultMessage(): string {
    return "No pudimos acceder a los archivos en este momento. Intenta de nuevo más tarde.";
  }
}

export const isSharePointNotFoundError = (error: unknown): boolean => {
  const message = getRawErrorMessage(error).toLowerCase();

  return (
    message.includes("404") ||
    message.includes("resource not found") ||
    message.includes("not found") ||
    message.includes("no se encontró") ||
    message.includes("does not exist")
  );
};

export const getUserFriendlySharePointMessage = (error: unknown): string => {
  if (error instanceof SharePointSetupError) {
    return error.message;
  }

  const raw = getRawErrorMessage(error);

  if (isSharePointNotFoundError(error)) {
    return "No se encontró ningún archivo en la carpeta del proceso.";
  }

  if (
    raw.includes("connections//") ||
    /connectionnotfound/i.test(raw) ||
    /sharepoint no está configurado/i.test(raw) ||
    /configura vite_sharepoint/i.test(raw)
  ) {
    return "No pudimos acceder a los archivos en este momento. Intenta de nuevo más tarde.";
  }

  return "No se pudieron cargar los archivos del proceso. Intenta de nuevo más tarde.";
};

const getRawErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error ?? "");
  }
};
