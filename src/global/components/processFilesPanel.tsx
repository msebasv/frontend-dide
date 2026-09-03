import { useEffect, useState } from "react";
import {
  IoDocumentTextOutline,
  IoFolderOpenOutline,
  IoOpenOutline,
} from "react-icons/io5";

import Button from "./button";
import LoadingState from "./loadingState";
import MediaPreviewViewer from "./mediaPreviewViewer";

import {
  canPreviewFile,
  getProcessFileBlob,
  getProcessFileKey,
  listProcessFiles,
} from "../../courses/services/processFileService";
import { getUserFriendlySharePointMessage } from "../../courses/errors/sharePointSetupError";
import type { ProcessFile } from "../../courses/types/course.types";

interface ProcessFilesPanelProps {
  folderBase: string;
  processId?: string;
  activityId?: string;
}

function ProcessFilesPanel({
  folderBase,
  processId,
  activityId,
}: ProcessFilesPanelProps) {
  const [files, setFiles] = useState<ProcessFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFileKey, setSelectedFileKey] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewMimeType, setPreviewMimeType] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      if (!folderBase.trim() && !processId) {
        setFiles([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await listProcessFiles(folderBase, processId, activityId);
        if (cancelled) return;

        setFiles(data);
        setSelectedFileKey(data[0] ? getProcessFileKey(data[0]) : "");
      } catch (loadError) {
        if (!cancelled) {
          setError(getUserFriendlySharePointMessage(loadError));
          setFiles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [folderBase, processId, activityId]);

  const selectedFile =
    files.find((file) => getProcessFileKey(file) === selectedFileKey) ?? null;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    const loadPreview = async () => {
      setPreviewUrl("");
      setPreviewMimeType("");

      if (!selectedFile) return;

      if (!canPreviewFile(selectedFile.name)) return;

      try {
        setPreviewLoading(true);
        const { blob, mimeType } = await getProcessFileBlob(selectedFile);
        if (cancelled) return;

        if (!canPreviewFile(selectedFile.name, mimeType)) return;

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setPreviewMimeType(mimeType);
      } catch {
        // Sin banner de error: se muestra el fallback con enlace a SharePoint.
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const openInSharePoint = (file: ProcessFile) => {
    if (!file.previewUrl) return;
    window.open(file.previewUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <LoadingState message="Cargando archivos del proceso..." />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2">
          <IoFolderOpenOutline className="shrink-0 text-primary" size={18} />
          <h3 className="text-sm font-semibold text-primary">
            Archivos del proceso
          </h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            {files.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Documentos de la actividad seleccionada · ábrelos en SharePoint
        </p>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <IoFolderOpenOutline className="text-gray-300" size={32} />
          <p className="text-sm font-medium text-primary">{error}</p>
          <p className="max-w-sm text-xs text-muted">
            Si el problema continúa, vuelve a intentarlo en unos minutos.
          </p>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <IoFolderOpenOutline className="text-gray-300" size={32} />
          <p className="text-sm font-medium text-primary">
            {folderBase.trim() || processId
              ? "No se encontró ningún archivo"
              : "Este proceso aún no tiene una carpeta configurada"}
          </p>
          <p className="max-w-sm text-xs text-muted">
            {folderBase.trim() || processId
              ? "Cuando se cargue material académico, aparecerá aquí."
              : "La carpeta se crea al iniciar el proceso de virtualización."}
          </p>
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-3">
          <div className="border-b border-border lg:col-span-1 lg:border-b-0 lg:border-r">
            <ul className="divide-y divide-border-light">
              {files.map((file) => {
                const fileKey = getProcessFileKey(file);
                const isSelected = selectedFileKey === fileKey;

                return (
                  <li key={fileKey}>
                    <button
                      type="button"
                      onClick={() => setSelectedFileKey(fileKey)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${
                        isSelected
                          ? "border-l-[3px] border-l-primary bg-primary/5"
                          : "hover:bg-gray-50/80"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "bg-gray-100 text-muted"
                        }`}
                      >
                        <IoDocumentTextOutline size={16} />
                      </div>
                      <span className="min-w-0 truncate font-medium text-primary">
                        {file.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="min-w-0 lg:col-span-2">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-primary">
                  {selectedFile?.name ?? "Vista previa"}
                </h4>
                {selectedFile && (
                  <p className="truncate text-xs text-muted">
                    {selectedFile.path}
                  </p>
                )}
              </div>
              {selectedFile?.previewUrl ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openInSharePoint(selectedFile)}
                >
                  <IoOpenOutline size={14} />
                  <span className="sm:hidden">SharePoint</span>
                  <span className="hidden sm:inline">Abrir en SharePoint</span>
                </Button>
              ) : null}
            </div>

            <div className="p-3 sm:p-5">
              {!selectedFile ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2">
                  <IoDocumentTextOutline className="text-gray-300" size={32} />
                  <p className="text-sm text-muted">
                    Selecciona un archivo para ver la vista previa
                  </p>
                </div>
              ) : previewLoading ? (
                <LoadingState message="Generando vista previa..." />
              ) : previewUrl ? (
                <MediaPreviewViewer
                  url={previewUrl}
                  fileName={selectedFile.name}
                  mimeType={previewMimeType}
                />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-gray-50/50 px-6 text-center">
                  <IoDocumentTextOutline className="text-gray-300" size={32} />
                  <p className="text-sm text-muted">
                    Abre el archivo en SharePoint para revisarlo.
                  </p>
                  {selectedFile.previewUrl ? (
                    <Button onClick={() => openInSharePoint(selectedFile)}>
                      <IoOpenOutline size={14} />
                      Abrir en SharePoint
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProcessFilesPanel;
