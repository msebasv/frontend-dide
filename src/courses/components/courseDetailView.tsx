import { useEffect, useMemo, useState } from "react";
import {
  IoCheckmarkCircle,
  IoChevronDownOutline,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoPersonOutline,
  IoReturnDownBackOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { Link } from "react-router-dom";
import clsx from "clsx";

import Button from "../../global/components/button";
import InfoCard from "../../global/components/infoCard";
import LoadingState from "../../global/components/loadingState";
import ProcessDeliverablesFilesPanel from "../../global/components/processDeliverablesFilesPanel";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import { formatDateTime } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { useAuth } from "../../global/hooks/useAuth";
import { isLeaderRole } from "../../global/constants/domainConstants";
import {
  canRoleValidateDeliverable,
  formatActivityStatus,
  isAuthorRole,
  isLeaderSyllabusStatus,
  isVirtualizationLeaderRole,
} from "../mappers/courseMappers";
import {
  formatDeliverableSharePointLocation,
  getDeliverableUploadStatus,
  isSyllabusDeliverable,
  listProcessDeliverableGroups,
  materialBelongsToDeliverable,
  normalizeFolderSegment,
  type ProcessDeliverableGroup,
  type ProcessDeliverableItem,
} from "../services/deliverableService";

import type { CourseDetail, CourseMaterial } from "../types/course.types";

export interface MaterialValidationContext {
  material: CourseMaterial;
  /** Nombre del entregable (categoría × crédito) cuando aplica. */
  deliverableName?: string;
}

interface CourseDetailViewProps {
  detail: CourseDetail;
  isValidationMode?: boolean;
  /** Mostrar botón Aprobar (validador/asesor/DIDE). */
  canApprove?: boolean;
  /** Mostrar botón Devolver (validador/asesor; no DIDE). */
  canReturn?: boolean;
  actionsDisabled?: boolean;
  selectedMaterialId?: string;
  onSelectedMaterialChange?: (activityId: string) => void;
  onApproveRequest?: (context: MaterialValidationContext) => void;
  onReturnRequest?: (context: MaterialValidationContext) => void;
}

const materialStatusStyle = (statusLabel: string): string => {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "bg-success/10 text-success";
  }
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "bg-danger/10 text-danger";
  }
  if (normalized.includes("por aprobar") || normalized.includes("proceso")) {
    return "bg-warning/10 text-warning";
  }

  return "bg-gray-100 text-muted";
};

const commentsLabel = (statusLabel: string, isAuthorUpload: boolean): string => {
  const normalized = statusLabel.toLowerCase();
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "Comentarios de devolución";
  }
  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "Observaciones";
  }
  if (isAuthorUpload) return "Descripción del material";
  return "Descripción / comentarios";
};

const actorLabel = (statusLabel: string, isAuthorUpload: boolean): string => {
  const normalized = statusLabel.toLowerCase();
  if (
    normalized.includes("devuelto") ||
    normalized.includes("corregir") ||
    normalized.includes("no aprobado")
  ) {
    return "Devuelto por";
  }
  if (normalized.includes("aprobado") && !normalized.includes("no ")) {
    return "Aprobado por";
  }
  if (isAuthorUpload) return "Cargado por";
  return "Realizado por";
};

const pickDefaultActivityId = (materials: CourseMaterial[]): string =>
  materials.find((item) => item.isAuthorUpload)?.activityId ??
  materials[0]?.activityId ??
  "";

function CourseDetailView({
  detail,
  isValidationMode = false,
  canApprove = false,
  canReturn = false,
  actionsDisabled = false,
  selectedMaterialId: controlledMaterialId,
  onSelectedMaterialChange,
  onApproveRequest,
  onReturnRequest,
}: CourseDetailViewProps) {
  const [groups, setGroups] = useState<ProcessDeliverableGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [selectedDeliverableId, setSelectedDeliverableId] = useState("");
  /** Créditos/grupos abiertos en el acordeón (0 = General). */
  const [expandedCredits, setExpandedCredits] = useState<number[]>([]);
  const [internalMaterialId, setInternalMaterialId] = useState(
    pickDefaultActivityId(detail.materials),
  );

  const selectedMaterialId = controlledMaterialId ?? internalMaterialId;
  const hasDeliverables = groups.length > 0;

  useEffect(() => {
    let cancelled = false;

    const loadGroups = async () => {
      if (!detail.processId.trim()) {
        setGroups([]);
        setGroupsLoading(false);
        return;
      }

      try {
        setGroupsLoading(true);
        setGroupsError("");
        const data = await listProcessDeliverableGroups(detail.processId);
        if (cancelled) return;
        setGroups(data);
        const allItems = data.flatMap((group) => group.items);
        setSelectedDeliverableId((current) => {
          if (current && allItems.some((item) => item.id === current)) {
            return current;
          }

          // Preferir el entregable de la actividad más reciente (p. ej. syllabus tras cargue).
          const latest = detail.materials[0];
          if (latest) {
            const owner = allItems.find((item) =>
              materialBelongsToDeliverable(latest, item),
            );
            if (owner) return owner.id;
          }

          return allItems[0]?.id ?? "";
        });
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
  }, [detail.processId, detail.materials]);

  const selectedDeliverable = useMemo((): ProcessDeliverableItem | null => {
    for (const group of groups) {
      const found = group.items.find((item) => item.id === selectedDeliverableId);
      if (found) return found;
    }
    return null;
  }, [groups, selectedDeliverableId]);

  const { currentRole } = useAuth();

  const selectedDeliverableStatus = useMemo(() => {
    if (!selectedDeliverable) return null;
    return getDeliverableUploadStatus(selectedDeliverable, detail.materials);
  }, [selectedDeliverable, detail.materials]);

  const canUploadCurrentDeliverable = useMemo(() => {
    if (!selectedDeliverable) return false;
    const isSyllabus = isSyllabusDeliverable(selectedDeliverable);

    // Líder de virtualización carga el syllabus
    if (isVirtualizationLeaderRole(currentRole) || isLeaderRole(currentRole)) {
      if (!isSyllabus) return false;
      return Boolean(selectedDeliverableStatus?.canUpload);
    }

    // Autor carga los entregables que no sean syllabus
    if (isAuthorRole(currentRole)) {
      // Mientras el proceso esté en cargue de syllabus, el autor no puede cargar
      if (isLeaderSyllabusStatus(detail.status)) return false;
      if (isSyllabus) return false;
      if (selectedDeliverableStatus?.canUpload) return true;

      const norm = normalizeFolderSegment(selectedDeliverable.stateLabel);
      const isReviewOrApproved =
        norm.includes("revis") ||
        norm.includes("evaluador") ||
        norm.includes("asesor") ||
        norm.includes("dide") ||
        norm.includes("aprobado") ||
        norm.includes("terminado") ||
        norm.includes("finalizado");

      if (isReviewOrApproved) return false;

      return (
        norm.includes("cargue") ||
        norm.includes("autor") ||
        norm.includes("pendiente") ||
        norm.includes("sin cargar") ||
        norm.includes("devuelto") ||
        norm.includes("corregir") ||
        norm.includes("no iniciado") ||
        norm.includes("noiniciado")
      );
    }

    return false;
  }, [selectedDeliverable, currentRole, selectedDeliverableStatus, detail.status]);

  const uploadButtonLabel = useMemo(() => {
    if (!selectedDeliverable) return "Cargar Material";
    if (isSyllabusDeliverable(selectedDeliverable)) return "Cargar syllabus";
    if (selectedDeliverableStatus?.kind === "returned") {
      return "Cargar corrección";
    }
    return "Cargar Material";
  }, [selectedDeliverable, selectedDeliverableStatus]);

  // Mantener abierto el grupo del entregable seleccionado.
  useEffect(() => {
    if (!selectedDeliverable) return;
    setExpandedCredits((current) =>
      current.includes(selectedDeliverable.creditNumber)
        ? current
        : [...current, selectedDeliverable.creditNumber],
    );
  }, [selectedDeliverable]);

  const toggleCreditGroup = (creditNumber: number) => {
    setExpandedCredits((current) =>
      current.includes(creditNumber)
        ? current.filter((value) => value !== creditNumber)
        : [...current, creditNumber],
    );
  };

  const scopedMaterials = useMemo(() => {
    if (!hasDeliverables || !selectedDeliverable) {
      return detail.materials;
    }

    return detail.materials.filter((material) =>
      materialBelongsToDeliverable(material, selectedDeliverable),
    );
  }, [detail.materials, hasDeliverables, selectedDeliverable]);

  const setSelectedMaterial = (activityId: string) => {
    if (onSelectedMaterialChange) {
      onSelectedMaterialChange(activityId);
      return;
    }
    setInternalMaterialId(activityId);
  };

  useEffect(() => {
    if (controlledMaterialId) return;
    setInternalMaterialId(pickDefaultActivityId(scopedMaterials));
  }, [controlledMaterialId, scopedMaterials]);

  useEffect(() => {
    if (!onSelectedMaterialChange) return;
    if (!hasDeliverables) return;

    const stillValid = scopedMaterials.some(
      (material) => material.activityId === selectedMaterialId,
    );
    if (stillValid) return;

    onSelectedMaterialChange(pickDefaultActivityId(scopedMaterials));
  }, [
    hasDeliverables,
    onSelectedMaterialChange,
    scopedMaterials,
    selectedMaterialId,
  ]);

  const handleSelectDeliverable = (deliverableId: string) => {
    setSelectedDeliverableId(deliverableId);

    const deliverable =
      groups
        .flatMap((group) => group.items)
        .find((item) => item.id === deliverableId) ?? null;

    const nextMaterials = deliverable
      ? detail.materials.filter((material) =>
          materialBelongsToDeliverable(material, deliverable),
        )
      : [];
    setSelectedMaterial(pickDefaultActivityId(nextMaterials));
  };

  const selectedMaterial =
    scopedMaterials.find(
      (material) => material.activityId === selectedMaterialId,
    ) ?? scopedMaterials[0] ?? null;

  const validationContext = (material: CourseMaterial): MaterialValidationContext => ({
    material: {
      ...material,
      deliverableId: material.deliverableId || selectedDeliverable?.id || "",
    },
    deliverableName: selectedDeliverable
      ? formatDeliverableSharePointLocation(selectedDeliverable)
      : undefined,
  });

  const deliverableValidation = useMemo(() => {
    if (!selectedDeliverable) {
      return { canApprove: false, canReturn: false, isValidationPhase: false };
    }
    return canRoleValidateDeliverable(
      currentRole,
      selectedDeliverable.stateLabel,
    );
  }, [currentRole, selectedDeliverable]);

  const canApproveCurrent = hasDeliverables
    ? deliverableValidation.canApprove
    : Boolean(canApprove);

  const canReturnCurrent = hasDeliverables
    ? deliverableValidation.canReturn
    : Boolean(canReturn);

  const isValidationModeCurrent = hasDeliverables
    ? deliverableValidation.isValidationPhase
    : Boolean(isValidationMode);

  const showValidationActions =
    canApproveCurrent || canReturnCurrent;

  const processInfoItems = [
    { label: "Proceso de virtualización", value: detail.processName },
    { label: "Curso", value: detail.courseName },
    { label: "Programa", value: detail.programName },
    { label: "Facultad", value: detail.facultyName },
  ];

  const deliverableCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  const renderMaterialDetail = (material: CourseMaterial) => {
    const statusLabel = formatActivityStatus(material.status);
    const latestAuthorVersion = scopedMaterials.find(
      (item) => item.isAuthorUpload,
    )?.version;

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-primary">{material.name}</h4>
            {material.version != null && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                Versión {material.version}
              </span>
            )}
            {material.isAuthorUpload &&
              material.version === latestAuthorVersion && (
                <span className="text-xs font-semibold text-primary/70">
                  Actual
                </span>
              )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${materialStatusStyle(statusLabel)}`}
            >
              {statusLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <IoTimeOutline size={13} />
              {formatDateTime(material.modifiedOn || material.createdOn)}
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-border/70 bg-white/70 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {actorLabel(statusLabel, material.isAuthorUpload)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-start gap-x-2 gap-y-1.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <IoPersonOutline size={14} className="shrink-0" />
                  {material.performedBy || material.performedByEmail || "—"}
                </p>
                {material.performedByEmail &&
                  material.performedBy &&
                  material.performedBy !== material.performedByEmail && (
                    <p className="mt-0.5 pl-[22px] text-xs text-muted">
                      {material.performedByEmail}
                    </p>
                  )}
              </div>
              {material.performedByRole &&
                material.performedByRole !== "—" && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {formatDomainLabel(material.performedByRole)}
                  </span>
                )}
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {commentsLabel(statusLabel, material.isAuthorUpload)}
            </p>
            {material.description?.trim() ? (
              <p className="mt-1 whitespace-pre-line text-sm text-muted">
                {material.description}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted/80">
                Sin comentarios registrados.
              </p>
            )}
          </div>
        </div>

        {showValidationActions && (
          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Decisión sobre este material
            </p>
            {selectedDeliverable && (
              <p className="mt-1 text-xs text-muted">
                Entregable:{" "}
                <span className="font-medium text-primary">
                  {formatDeliverableSharePointLocation(selectedDeliverable)}
                </span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {canReturnCurrent && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={actionsDisabled}
                  onClick={() =>
                    onReturnRequest?.(validationContext(material))
                  }
                >
                  <IoReturnDownBackOutline size={16} />
                  Devolver
                </Button>
              )}
              {canApproveCurrent && (
                <Button
                  size="sm"
                  disabled={actionsDisabled}
                  onClick={() =>
                    onApproveRequest?.(validationContext(material))
                  }
                >
                  <IoCheckmarkCircle size={16} />
                  Aprobar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActivityList = (materials: CourseMaterial[]) => {
    if (materials.length === 0) {
      return (
        <p className="px-5 py-12 text-center text-sm text-muted">
          {hasDeliverables
            ? "Este entregable aún no tiene actividades registradas"
            : "No hay material cargado aún"}
        </p>
      );
    }

    const latestAuthorVersion = materials.find(
      (item) => item.isAuthorUpload,
    )?.version;

    return (
      <ul className="max-h-[36dvh] divide-y divide-border-light overflow-y-auto lg:max-h-[28rem]">
        {materials.map((material) => {
          const statusLabel = formatActivityStatus(material.status);
          const statusDate = formatDateTime(
            material.modifiedOn || material.createdOn,
          );
          const isLatestAuthorUpload =
            material.isAuthorUpload &&
            material.version === latestAuthorVersion;
          const isSelected = selectedMaterialId === material.activityId;

          return (
            <li key={material.activityId}>
              <button
                type="button"
                onClick={() => setSelectedMaterial(material.activityId)}
                className={clsx(
                  "flex w-full items-start gap-3 px-5 py-3.5 text-left text-sm transition-all",
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
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-primary">
                      {material.name}
                    </p>
                    {material.version != null && (
                      <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        V{material.version}
                      </span>
                    )}
                    {isLatestAuthorUpload && (
                      <span className="shrink-0 text-[10px] font-semibold text-primary/70">
                        Actual
                      </span>
                    )}
                  </div>
                  {(material.performedBy || material.performedByEmail) &&
                    material.performedBy !== "—" && (
                      <p className="mt-1 truncate text-[11px] text-muted">
                        <IoPersonOutline
                          className="mr-1 inline align-[-2px]"
                          size={11}
                        />
                        {material.performedBy || material.performedByEmail}
                      </p>
                    )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${materialStatusStyle(statusLabel)}`}
                    >
                      {statusLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                      <IoTimeOutline size={12} />
                      {statusDate}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InfoCard title="Información del proceso" items={processInfoItems} />

      {groupsLoading ? (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
          <LoadingState message="Cargando entregables del proceso..." />
        </div>
      ) : hasDeliverables ? (
        <>
          <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-4">
              <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
                <h3 className="text-sm font-semibold text-primary">
                  Entregables del proceso
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {deliverableCount}
                  </span>
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Despliega General o cada crédito/unidad para ver sus
                  entregables y consultar la trazabilidad.
                </p>
              </div>

              <div className="max-h-[50dvh] space-y-2 overflow-y-auto p-3 sm:p-4">
                {groups.map((group) => {
                  const isExpanded = expandedCredits.includes(
                    group.creditNumber,
                  );
                  const groupActivityCount = group.items.reduce(
                    (total, item) =>
                      total +
                      detail.materials.filter((material) =>
                        materialBelongsToDeliverable(material, item),
                      ).length,
                    0,
                  );

                  return (
                    <div
                      key={group.creditNumber}
                      className="overflow-hidden rounded-xl border border-border"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCreditGroup(group.creditNumber)}
                        className="flex w-full items-center gap-2 bg-acacia-5/60 px-3 py-2.5 text-left transition hover:bg-acacia-5"
                        aria-expanded={isExpanded}
                      >
                        <IoChevronDownOutline
                          size={16}
                          className={clsx(
                            "shrink-0 text-primary transition-transform",
                            isExpanded ? "rotate-0" : "-rotate-90",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-primary">
                            {group.label}
                          </p>
                          <p className="text-[11px] text-muted">
                            {group.items.length}{" "}
                            {group.items.length === 1
                              ? "entregable"
                              : "entregables"}
                            {groupActivityCount > 0
                              ? ` · ${groupActivityCount} actividad${groupActivityCount === 1 ? "" : "es"}`
                              : ""}
                          </p>
                        </div>
                      </button>

                      {isExpanded && (
                        <ul className="space-y-1 border-t border-border p-2">
                          {group.items.map((item) => {
                            const isSelected =
                              item.id === selectedDeliverableId;
                            const activityCount = detail.materials.filter(
                              (material) =>
                                materialBelongsToDeliverable(material, item),
                            ).length;

                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSelectDeliverable(item.id)
                                  }
                                  className={clsx(
                                    "w-full rounded-lg border px-3 py-2.5 text-left transition",
                                    isSelected
                                      ? "border-primary/30 bg-primary/5"
                                      : "border-transparent hover:border-border hover:bg-acacia-5/80",
                                  )}
                                >
                                  <p className="truncate text-sm font-semibold text-primary">
                                    {item.name}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-muted">
                                    {formatDeliverableSharePointLocation(item)}
                                  </p>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <ProcessStatus status={item.stateLabel} />
                                    <span className="text-[10px] text-muted">
                                      {activityCount === 0
                                        ? "Sin actividades"
                                        : `${activityCount} actividad${activityCount === 1 ? "" : "es"}`}
                                    </span>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 space-y-4 lg:col-span-8">
              <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
                <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-primary">
                          {selectedDeliverable
                            ? selectedDeliverable.name
                            : "Actividades del entregable"}
                        </h3>
                        {selectedDeliverable && (
                          <ProcessStatus
                            status={selectedDeliverable.stateLabel}
                          />
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {selectedDeliverable
                          ? formatDeliverableSharePointLocation(
                              selectedDeliverable,
                            )
                          : "Selecciona un entregable"}
                        {isValidationModeCurrent
                          ? " · Elige la actividad a revisar; Aprobar/Devolver aplica solo a este material."
                          : ""}
                      </p>
                    </div>

                    {canUploadCurrentDeliverable && selectedDeliverable && (
                      <div className="shrink-0">
                        <Link
                          to={`/courses/${detail.processId}/upload`}
                          state={{ deliverableId: selectedDeliverable.id }}
                        >
                          <Button
                            variant="primary"
                            className="!py-1.5 !px-3 !text-xs font-semibold gap-1.5 shadow-sm"
                          >
                            <IoCloudUploadOutline size={16} />
                            {uploadButtonLabel}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-5">
                  <div className="border-b border-border lg:col-span-2 lg:border-b-0 lg:border-r">
                    {renderActivityList(scopedMaterials)}
                  </div>
                  <div className="min-w-0 p-3 sm:p-5 lg:col-span-3">
                    {selectedMaterial ? (
                      renderMaterialDetail(selectedMaterial)
                    ) : scopedMaterials.length === 0 &&
                      canUploadCurrentDeliverable &&
                      selectedDeliverable ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <IoCloudUploadOutline size={26} />
                        </div>
                        <div className="max-w-sm space-y-1">
                          <p className="text-sm font-semibold text-primary">
                            Este entregable está pendiente de cargue
                          </p>
                          <p className="text-xs text-muted">
                            {isSyllabusDeliverable(selectedDeliverable)
                              ? "Como Líder de Virtualización, puedes subir el Syllabus para dar inicio al flujo de revisión."
                              : "Como Autor del curso, puedes subir los documentos correspondientes a este entregable."}
                          </p>
                        </div>
                        <Link
                          to={`/courses/${detail.processId}/upload`}
                          state={{ deliverableId: selectedDeliverable.id }}
                          className="mt-2"
                        >
                          <Button
                            variant="primary"
                            className="gap-2 text-xs font-semibold"
                          >
                            <IoCloudUploadOutline size={16} />
                            {uploadButtonLabel}
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex h-56 flex-col items-center justify-center gap-2">
                        <IoDocumentTextOutline
                          className="text-gray-300"
                          size={32}
                        />
                        <p className="text-sm text-muted">
                          {scopedMaterials.length === 0
                            ? "No hay actividades registradas en este entregable"
                            : "Selecciona una actividad"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ProcessDeliverablesFilesPanel
            processId={detail.processId}
            folderBase={detail.folderBase}
            activityId={selectedMaterial?.activityId}
            selectedDeliverable={selectedDeliverable}
            hideNavigator
          />
        </>
      ) : (
        <>
          {groupsError && (
            <p className="rounded-lg border border-border bg-acacia-5 px-4 py-2 text-xs text-muted">
              {groupsError} Se muestran las actividades generales del proceso.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-1">
              <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
                <h3 className="text-sm font-semibold text-primary">
                  Actividades del proceso
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {detail.materials.length}
                  </span>
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {isValidationMode
                    ? "Selecciona la actividad a revisar. Aprobar/Devolver aplica solo a ese material."
                    : "Cargas del autor (con versión) y revisiones del proceso, de la más reciente a la más antigua."}
                </p>
              </div>
              {renderActivityList(detail.materials)}
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-2">
              <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
                <h3 className="text-sm font-semibold text-primary">
                  Detalle del material
                </h3>
              </div>
              <div className="p-3 sm:p-5">
                {selectedMaterial ? (
                  renderMaterialDetail(selectedMaterial)
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-2">
                    <IoDocumentTextOutline className="text-gray-300" size={32} />
                    <p className="text-sm text-muted">
                      Selecciona un material para revisarlo
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <ProcessDeliverablesFilesPanel
            processId={detail.processId}
            folderBase={detail.folderBase}
            activityId={selectedMaterial?.activityId}
          />
        </>
      )}
    </div>
  );
}

export default CourseDetailView;
