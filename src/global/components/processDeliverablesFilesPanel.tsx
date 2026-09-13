/**
 * Archivos de un entregable (categoría × crédito) o, sin entregables,
 * la carpeta general del proceso/actividad.
 */
import { useEffect, useMemo, useState } from "react";
import {
  IoDocumentTextOutline,
  IoFolderOpenOutline,
  IoOpenOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import clsx from "clsx";

import Button from "./button";
import LoadingState from "./loadingState";
import MediaPreviewViewer from "./mediaPreviewViewer";

import {
  canPreviewFile,
  getProcessFileBlob,
  getProcessFileKey,
  listProcessFiles,
} from "../../courses/services/processFileService";
import {
  fileBelongsToActivity,
  fileBelongsToDeliverable,
  formatCreditFolderSegment,
  formatDeliverableSharePointLocation,
  listProcessDeliverableGroups,
  resolveDeliverableFilesFolder,
  type ProcessDeliverableGroup,
  type ProcessDeliverableItem,
} from "../../courses/services/deliverableService";
import { getUserFriendlySharePointMessage } from "../../courses/errors/sharePointSetupError";
import type { ProcessFile } from "../../courses/types/course.types";
import ProcessFilesPanel from "./processFilesPanel";

interface ProcessDeliverablesFilesPanelProps {
  processId: string;
  folderBase: string;
  /** Fallback: filtrar por actividad si no hay entregables. */
  activityId?: string;
  /** Cuando el padre ya eligió la categoría, solo se muestran sus archivos. */
  selectedDeliverable?: ProcessDeliverableItem | null;
  /** Oculta el selector interno de categorías (el padre lo controla). */
  hideNavigator?: boolean;
}

function ProcessDeliverablesFilesPanel({
  processId,
  folderBase,
  activityId,
  selectedDeliverable: controlledDeliverable,
  hideNavigator = false,
}: ProcessDeliverablesFilesPanelProps) {
  const [groups, setGroups] = useState<ProcessDeliverableGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(!hideNavigator);
  const [groupsError, setGroupsError] = useState("");
  const [internalSelectedId, setInternalSelectedId] = useState("");

  const [allProcessFiles, setAllProcessFiles] = useState<ProcessFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [selectedFileKey, setSelectedFileKey] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewMimeType, setPreviewMimeType] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const handleRefresh = () => setRefreshIndex((k) => k + 1);

  useEffect(() => {
    if (hideNavigator) {
      setGroupsLoading(false);
      return;
    }

    let cancelled = false;

    const loadGroups = async () => {
      if (!processId.trim()) {
        setGroups([]);
        setGroupsLoading(false);
        return;
      }

      try {
        setGroupsLoading(true);
        setGroupsError("");
        const data = await listProcessDeliverableGroups(processId);
        if (cancelled) return;

        setGroups(data);
        const first = data.flatMap((group) => group.items).find(Boolean);
        setInternalSelectedId(first?.id ?? "");
      } catch (error) {
        if (!cancelled) {
          console.error("Error cargando entregables", error);
          setGroupsError(
            "No se pudieron cargar los entregables del proceso.",
          );
          setGroups([]);
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    };

    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [processId, hideNavigator]);

  const selectedDeliverable = useMemo((): ProcessDeliverableItem | null => {
    if (hideNavigator) {
      return controlledDeliverable ?? null;
    }

    for (const group of groups) {
      const found = group.items.find((item) => item.id === internalSelectedId);
      if (found) return found;
    }
    return null;
  }, [
    controlledDeliverable,
    groups,
    hideNavigator,
    internalSelectedId,
  ]);

  /** Carpeta hoja SharePoint: proceso/categoría/general|credito N */
  const filesFolder = useMemo(() => {
    if (!selectedDeliverable) return "";
    return resolveDeliverableFilesFolder(selectedDeliverable, folderBase);
  }, [selectedDeliverable, folderBase]);

  const filesLocationLabel = useMemo(() => {
    if (!selectedDeliverable) return "";
    return formatDeliverableSharePointLocation(selectedDeliverable);
  }, [selectedDeliverable]);

  // Carga única de todos los archivos del proceso desde SharePoint
  useEffect(() => {
    let cancelled = false;

    const loadAllFiles = async () => {
      const processFolder =
        folderBase?.trim() || (processId ? `proceso-${processId}` : "");
      if (!processFolder && !processId) {
        setAllProcessFiles([]);
        setFilesError("");
        return;
      }

      try {
        setFilesLoading(true);
        setFilesError("");
        const data = await listProcessFiles(processFolder, processId);
        if (cancelled) return;

        setAllProcessFiles(data);
      } catch (error) {
        if (!cancelled) {
          setFilesError(getUserFriendlySharePointMessage(error));
          setAllProcessFiles([]);
        }
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    };

    void loadAllFiles();
    return () => {
      cancelled = true;
    };
  }, [folderBase, processId, refreshIndex]);

  // Filtra por categoría y, si hay actividad seleccionada, SOLO esa carpeta
  // vNN-estado-idActivity (igual para validador, asesor, diseñador, autor, etc.).
  const files = useMemo((): ProcessFile[] => {
    let scoped = allProcessFiles;

    if (selectedDeliverable) {
      scoped = scoped.filter((file) =>
        fileBelongsToDeliverable(
          file,
          selectedDeliverable,
          processId,
          folderBase,
        ),
      );
    }

    if (activityId) {
      return scoped.filter((file) =>
        fileBelongsToActivity(
          file.connectorPath || file.path || "",
          activityId,
        ),
      );
    }

    if (selectedDeliverable) return scoped;
    return [];
  }, [allProcessFiles, selectedDeliverable, processId, folderBase, activityId]);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const va = a.versionNumber ?? 0;
      const vb = b.versionNumber ?? 0;
      if (vb !== va) return vb - va;
      return a.name.localeCompare(b.name, "es");
    });
  }, [files]);

  // Sincronizar archivo seleccionado en el visor
  useEffect(() => {
    if (sortedFiles.length === 0) {
      setSelectedFileKey("");
      return;
    }
    const exists = sortedFiles.some(
      (file) => getProcessFileKey(file) === selectedFileKey,
    );
    if (!exists) {
      setSelectedFileKey(getProcessFileKey(sortedFiles[0]));
    }
  }, [sortedFiles, selectedFileKey]);

  const selectedFile =
    sortedFiles.find((file) => getProcessFileKey(file) === selectedFileKey) ??
    null;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    const loadPreview = async () => {
      setPreviewUrl("");
      setPreviewMimeType("");

      if (!selectedFile || !canPreviewFile(selectedFile.name)) return;

      try {
        setPreviewLoading(true);
        const { blob, mimeType } = await getProcessFileBlob(selectedFile);
        if (cancelled) return;
        if (!canPreviewFile(selectedFile.name, mimeType)) return;

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setPreviewMimeType(mimeType);
      } catch {
        // Fallback: enlace a SharePoint.
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

  const filesSection = (
    <div className="grid gap-0 lg:grid-cols-5">
      <div className="border-b border-border lg:col-span-2 lg:border-b-0 lg:border-r">
        {filesLoading ? (
          <div className="p-4">
            <LoadingState message="Cargando archivos..." />
          </div>
        ) : filesError ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{filesError}</p>
        ) : sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <IoFolderOpenOutline className="text-gray-300" size={28} />
            <p className="text-sm font-medium text-primary">
              {activityId
                ? "No hay archivos para la actividad seleccionada"
                : selectedDeliverable
                ? "No hay archivos cargados para este entregable y crédito"
                : "Selecciona un entregable para ver sus archivos"}
            </p>
            {filesLocationLabel ? (
              <p className="font-mono text-[11px] text-muted/80">
                {filesLocationLabel}
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {sortedFiles.map((file) => {
              const fileKey = getProcessFileKey(file);
              const isSelected = selectedFileKey === fileKey;
              const versionLabel =
                file.versionNumber != null
                  ? `V${String(file.versionNumber).padStart(2, "0")}`
                  : null;
              return (
                <li key={fileKey}>
                  <button
                    type="button"
                    onClick={() => setSelectedFileKey(fileKey)}
                    className={clsx(
                      "flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-all",
                      isSelected
                        ? "border-l-[3px] border-l-primary bg-primary/5"
                        : "hover:bg-gray-50/80",
                    )}
                  >
                    <div
                      className={clsx(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-100 text-muted",
                      )}
                    >
                      <IoDocumentTextOutline size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-primary">
                        {file.name}
                      </span>
                      {(versionLabel || file.versionStatusLabel) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {versionLabel && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              {versionLabel}
                            </span>
                          )}
                          {file.versionStatusLabel && (
                            <span
                              className="truncate text-[10px] text-muted"
                              title={file.versionFolder}
                            >
                              {file.versionStatusLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="min-w-0 p-3 sm:p-5 lg:col-span-3">
        {!selectedFile ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2">
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
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-gray-50/50 px-6 text-center">
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
  );

  if (hideNavigator) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <IoFolderOpenOutline className="shrink-0 text-primary" size={18} />
                <h3 className="text-sm font-semibold text-primary">
                  Archivos del entregable
                </h3>
                {sortedFiles.length > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {sortedFiles.length}{" "}
                    {sortedFiles.length === 1 ? "archivo" : "archivos"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {selectedDeliverable
                  ? `${filesLocationLabel}${
                      filesFolder ? ` · ${filesFolder}` : ""
                    }`
                  : "Selecciona un entregable arriba"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={filesLoading}
                title="Actualizar archivos desde SharePoint"
              >
                <IoRefreshOutline
                  className={clsx("shrink-0", filesLoading && "animate-spin")}
                  size={15}
                />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
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
          </div>
        </div>
        {filesSection}
      </div>
    );
  }

  if (groupsLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <LoadingState message="Cargando estructura de archivos..." />
      </div>
    );
  }

  // Sin entregables aún: comportamiento anterior (carpeta del proceso/actividad).
  if (groups.length === 0) {
    return (
      <div className="space-y-3">
        {groupsError && (
          <p className="rounded-lg border border-border bg-acacia-5 px-4 py-2 text-xs text-muted">
            {groupsError} Se muestra la carpeta general del proceso.
          </p>
        )}
        <ProcessFilesPanel
          folderBase={folderBase}
          processId={processId}
          activityId={activityId}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2">
          <IoFolderOpenOutline className="shrink-0 text-primary" size={18} />
          <h3 className="text-sm font-semibold text-primary">
            Archivos por entregable y crédito
          </h3>
        </div>
        <p className="mt-1 text-xs text-muted">
          SharePoint: proceso → entregable → credito-N → vNN-estado-idActivity →
          archivo
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-12">
        <div className="border-b border-border lg:col-span-4 lg:border-b-0 lg:border-r">
          <div className="max-h-[50dvh] space-y-3 overflow-y-auto p-3 sm:p-4">
            {groups.map((group) => (
              <div key={group.creditNumber}>
                <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isSelected = item.id === internalSelectedId;
                    const location = formatDeliverableSharePointLocation(item);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setInternalSelectedId(item.id)}
                          className={clsx(
                            "w-full rounded-xl border px-3 py-2.5 text-left transition",
                            isSelected
                              ? "border-primary/30 bg-primary/5"
                              : "border-transparent hover:border-border hover:bg-acacia-5/80",
                          )}
                        >
                          <p className="truncate text-sm font-semibold text-primary">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {formatCreditFolderSegment(item.creditNumber)}
                          </p>
                          <p className="mt-1 truncate font-mono text-[10px] text-muted/80">
                            {location}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-primary">
                {selectedDeliverable
                  ? filesLocationLabel
                  : "Selecciona un entregable"}
              </h4>
              {filesFolder ? (
                <p className="truncate font-mono text-[11px] text-muted">
                  {filesFolder}
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Este entregable aún no tiene carpeta configurada
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={filesLoading}
                title="Actualizar archivos desde SharePoint"
              >
                <IoRefreshOutline
                  className={clsx("shrink-0", filesLoading && "animate-spin")}
                  size={15}
                />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
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
          </div>
          {filesSection}
        </div>
      </div>
    </div>
  );
}

export default ProcessDeliverablesFilesPanel;
