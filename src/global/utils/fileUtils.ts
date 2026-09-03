/**
 * Convierte un archivo del navegador a Base64 sin prefijo data-URL.
 * Requerido por los flujos de Power Automate que suben archivos temporales.
 */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`No se pudo leer el archivo "${file.name}".`));
        return;
      }

      // FileReader devuelve "data:mime;base64,XXXX" — solo necesitamos la parte base64
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () =>
      reject(new Error(`No se pudo leer el archivo "${file.name}".`));
    reader.readAsDataURL(file);
  });
