/**
 * Archivos de un entregable (categoría × crédito) o, sin entregables,
 * la carpeta general del proceso/actividad.
 */
import { useEffect, useMemo, useState } from "react";
import {
  IoDocumentTextOutline,
  IoFolderOpenOutline,
  IoLinkOutline,
  IoOpenOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import clsx from "clsx";

import Button from "./button";
import LoadingState from "./loadingState";

import {
  getProcessFileKey,
  listProcessFiles,
  resolveProcessFileSharePointUrl,
} from "../../courses/services/processFileService";
import {
  fileBelongsToActivity,
  fileBelongsToDeliverable,
  formatCreditFolderSegment,
  formatDeliverableSharePointLocation,
  listProcessDeliverableGroups,
  pathLooksLikeAdvisorGuide,
  resolveDeliverableFilesFolder,
  type ProcessDeliverableGroup,
  type ProcessDeliverableItem,
} from "../../courses/services/deliverableService";
import { getUserFriendlySharePointMessage } from "../../courses/errors/sharePointSetupError";
import type { ProcessFile } from "../../courses/types/course.types";
import type { AudiovisualLinkEntry } from "../../global/utils/inputValidation";
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
  /**
   * Si la actividad del guión no coincide por GUID en la carpeta,
   * muestra archivos cuya ruta/carpeta de versión indique guión instruccional.
   */
  includeGuideFolderFallback?: boolean;
  /** Enlaces audiovisuales del diseñador DIDE (no viven en SharePoint). */
  audiovisualLinks?: AudiovisualLinkEntry[];
  /**
   * Comentarios/notas del registro de enlaces (texto sin URLs).
   * `undefined` = no es la vista de enlaces; string (aunque vacío) = sí lo es.
   */
  audiovisualNotes?: string;
}

function ProcessDeliverablesFilesPanel({
  processId,
  folderBase,
  activityId,
  selectedDeliverable: controlledDeliverable,
  hideNavigator = false,
  includeGuideFolderFallback = false,
  audiovisualLinks = [],
  audiovisualNotes,
}: ProcessDeliverablesFilesPanelProps) {
  const [groups, setGroups] = useState<ProcessDeliverableGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(!hideNavigator);
  const [groupsError, setGroupsError] = useState("");
  const [internalSelectedId, setInternalSelectedId] = useState("");

  const [allProcessFiles, setAllProcessFiles] = useState<ProcessFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
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
      } catch {
        if (!cancelled) {
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
      const byActivity = scoped.filter((file) =>
        fileBelongsToActivity(
          file.connectorPath || file.path || "",
          activityId,
        ),
      );
      if (byActivity.length > 0) return byActivity;

      if (includeGuideFolderFallback) {
        const guides = scoped.filter((file) =>
          pathLooksLikeAdvisorGuide(file.connectorPath || file.path || ""),
        );
        if (guides.length > 0) return guides;
      }
      return byActivity;
    }

    if (selectedDeliverable) return scoped;
    return [];
  }, [
    allProcessFiles,
    selectedDeliverable,
    processId,
    folderBase,
    activityId,
    includeGuideFolderFallback,
  ]);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const va = a.versionNumber ?? 0;
      const vb = b.versionNumber ?? 0;
      if (vb !== va) return vb - va;
      return a.name.localeCompare(b.name, "es");
    });
  }, [files]);

  const openInSharePoint = (file: ProcessFile) => {
    const url = resolveProcessFileSharePointUrl(file);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const hasAudiovisualLinks = audiovisualLinks.length > 0;
  const isAudiovisualView =
    hasAudiovisualLinks || audiovisualNotes !== undefined;
  const audiovisualNotesText = (audiovisualNotes ?? "").trim();

  const hasListItems = sortedFiles.length > 0 || hasAudiovisualLinks;

  const audiovisualNotesBlock = isAudiovisualView ? (
    <div className="shrink-0 border-b border-border bg-acacia-5/50 px-4 py-3 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Observaciones / comentarios
      </p>
      {audiovisualNotesText ? (
        <p className="mt-1.5 whitespace-pre-line text-sm text-primary">
          {audiovisualNotesText}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-muted/80">
          Sin comentarios adicionales en este registro.
        </p>
      )}
    </div>
  ) : null;

  const filesSection = (
    <div className="max-h-72 overflow-y-auto">
        {filesLoading ? (
          <div className="p-4">
            <LoadingState message="Cargando archivos..." />
          </div>
        ) : filesError ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{filesError}</p>
        ) : !hasListItems ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <IoFolderOpenOutline className="text-gray-300" size={28} />
            <p className="text-sm font-medium text-primary">
              {isAudiovisualView
                ? "No hay enlaces ni archivos en este registro"
                : activityId
                  ? "No hay archivos visibles para la actividad seleccionada"
                  : selectedDeliverable
                    ? "No hay archivos visibles para este entregable"
                    : "Seleccione un entregable para consultar sus archivos"}
            </p>
            {selectedDeliverable && !isAudiovisualView ? (
              <p className="max-w-sm text-xs text-muted">
                Si el archivo ya se cargó y no aparece, su cuenta no tiene
                permiso para ver la carpeta en SharePoint.
              </p>
            ) : null}
            {filesLocationLabel && !isAudiovisualView ? (
              <p className="font-mono text-[11px] text-muted/80">
                {filesLocationLabel}
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {hasAudiovisualLinks
              ? audiovisualLinks.map((entry, index) => (
                  <li
                    key={`link-${index}`}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-muted">
                      <IoLinkOutline size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {entry.label || `Enlace ${index + 1}`}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium text-primary">
                        {entry.url}
                      </span>
                    </div>
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-acacia-5"
                    >
                      <IoOpenOutline size={14} />
                      Abrir enlace
                    </a>
                  </li>
                ))
              : null}
            {sortedFiles.map((file) => {
              const fileKey = getProcessFileKey(file);
              const sharePointUrl = resolveProcessFileSharePointUrl(file);
              const versionLabel =
                file.versionNumber != null
                  ? `V${String(file.versionNumber).padStart(2, "0")}`
                  : null;
              return (
                <li
                  key={fileKey}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-muted">
                    <IoDocumentTextOutline size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-primary">
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
                  {sharePointUrl ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openInSharePoint(file)}
                    >
                      <IoOpenOutline size={14} />
                      <span className="hidden sm:inline">
                        Abrir en SharePoint
                      </span>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );

  if (hideNavigator) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <IoFolderOpenOutline className="shrink-0 text-primary" size={18} />
                <h3 className="text-sm font-semibold text-primary">
                  Archivos del entregable
                </h3>
                {sortedFiles.length > 0 || hasAudiovisualLinks ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {isAudiovisualView
                      ? hasAudiovisualLinks
                        ? `${audiovisualLinks.length} ${
                            audiovisualLinks.length === 1 ? "enlace" : "enlaces"
                          }`
                        : "Sin enlaces"
                      : `${sortedFiles.length} ${
                          sortedFiles.length === 1 ? "archivo" : "archivos"
                        }`}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {selectedDeliverable
                  ? `${filesLocationLabel}${
                      filesFolder ? ` · ${filesFolder}` : ""
                    }`
                  : "Seleccione un entregable arriba"}
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
            </div>
          </div>
        </div>
        {audiovisualNotesBlock}
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
            Archivos por entregable y unidad
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
                  : "Seleccione un entregable"}
              </h4>
              {filesFolder ? (
                <p className="truncate font-mono text-[11px] text-muted">
                  {filesFolder}
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Este entregable no tiene carpeta configurada
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
            </div>
          </div>
          {filesSection}
        </div>
      </div>
    </div>
  );
}

export default ProcessDeliverablesFilesPanel;
