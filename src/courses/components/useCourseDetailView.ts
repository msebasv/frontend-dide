/**
 * Hook de estado y reglas de negocio para la vista de detalle de curso.
 *
 * Carga grupos de entregables, selección entregable/actividad, pestañas
 * (Actual, Correcciones, Historial, Versión final), permisos de cargue,
 * aprobar/devolver y avisos (validador, diseñador DIDE, aula).
 */
import { useEffect, useMemo, useState } from "react";
import {
  IoDocumentTextOutline,
  IoFlashOutline,
  IoReturnDownBackOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { lookupOrganizationDisplayNames } from "../services/userService";
import { movementCreatedOn } from "../../global/utils/dateUtils";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { useAuth } from "../../global/hooks/useAuth";
import {
  canUploadProcessSyllabus,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";
import {
  canRoleValidateDeliverable,
  hasAssignedDideDesigner,
  hasAssignedValidator,
  isAdvisorAudiovisualApprovalStatus,
  isAdvisorGuideUploadStatus,
  isAdvisorRole,
  isAuthorRole,
  isLeaderClassroomConfirmStatus,
  isLeaderSyllabusStatus,
} from "../mappers/courseMappers";
import {
  getDeliverableUploadStatus,
  isSyllabusDeliverable,
  listProcessDeliverableGroups,
  materialBelongsToDeliverable,
  normalizeFolderSegment,
  type ProcessDeliverableGroup,
  type ProcessDeliverableItem,
} from "../services/deliverableService";
import type { CourseDetail, CourseMaterial } from "../types/course.types";
import {
  collectMaterialLinks,
  isAdvisorGuideMaterial,
  isCorrectionMaterial,
  isDideLinksMaterial,
  pickDefaultActivityId,
  type DeliverableDetailTab,
  type MaterialValidationContext,
} from "./courseDetailViewHelpers";

/** Parámetros del hook (detalle del proceso y props de validación opcionales). */
export interface UseCourseDetailViewParams {
  detail: CourseDetail;
  /** Fallback cuando no hay entregables agrupados (modo legacy). */
  canApprove?: boolean;
  canReturn?: boolean;
  /** Control externo de la actividad seleccionada (p. ej. validación). */
  selectedMaterialId?: string;
  onSelectedMaterialChange?: (activityId: string) => void;
}

/**
 * Orquesta datos y flags para `CourseDetailView`.
 * Devuelve grupos, selección, pestañas, materiales filtrados por entregable,
 * targets de validación/cargue y metadatos del proceso para InfoCard.
 */
export function useCourseDetailView({
  detail,
  canApprove = false,
  canReturn = false,
  selectedMaterialId: controlledMaterialId,
  onSelectedMaterialChange,
}: UseCourseDetailViewParams) {
  const [groups, setGroups] = useState<ProcessDeliverableGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [selectedDeliverableId, setSelectedDeliverableId] = useState("");
  /** Créditos/grupos abiertos en el acordeón (0 = General). */
  const [expandedCredits, setExpandedCredits] = useState<number[]>([]);
  const [detailTab, setDetailTab] = useState<DeliverableDetailTab>("actual");
  const [expandedCorrectionIds, setExpandedCorrectionIds] = useState<string[]>(
    [],
  );
  const [internalMaterialId, setInternalMaterialId] = useState(
    pickDefaultActivityId(detail.materials),
  );

  const selectedMaterialId = controlledMaterialId ?? internalMaterialId;
  const hasDeliverables = groups.length > 0;
  const [directoryNames, setDirectoryNames] = useState<Record<string, string>>(
    {},
  );
  const assignedPeopleKey = detail.assignedRoles
    .map((assigned) => `${assigned.role}|${assigned.name}|${assigned.email}`)
    .join(";");

  useEffect(() => {
    const missing = [
      ...new Set(
        detail.assignedRoles
          .filter((assigned) => {
            const email = assigned.email.trim().toLowerCase();
            const name = assigned.name.trim();
            return (
              Boolean(email) &&
              (!name || name.toLowerCase() === email)
            );
          })
          .map((assigned) => assigned.email.trim()),
      ),
    ];
    if (!missing.length) return;

    let cancelled = false;
    lookupOrganizationDisplayNames(missing)
      .then((names) => {
        if (cancelled) return;
        setDirectoryNames(Object.fromEntries(names));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [assignedPeopleKey, detail.assignedRoles]);

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
  }, [detail.processId, detail.materials]);

  const selectedDeliverable = useMemo((): ProcessDeliverableItem | null => {
    for (const group of groups) {
      const found = group.items.find((item) => item.id === selectedDeliverableId);
      if (found) return found;
    }
    return null;
  }, [groups, selectedDeliverableId]);

  const { currentRole } = useAuth();

  const processHasValidator = useMemo(
    () => hasAssignedValidator(detail.assignedRoles),
    [detail.assignedRoles],
  );

  const processHasDideDesigner = useMemo(
    () => hasAssignedDideDesigner(detail.assignedRoles),
    [detail.assignedRoles],
  );

  const needsValidatorForSyllabus =
    isLeaderSyllabusStatus(detail.status) && !processHasValidator;

  const selectedIsGuideUpload = Boolean(
    selectedDeliverable &&
      isAdvisorGuideUploadStatus(selectedDeliverable.stateLabel),
  );

  /** El entregable está en guión y el proceso todavía no tiene diseñador DIDE. */
  const needsDesignerForGuide =
    selectedIsGuideUpload && !processHasDideDesigner;

  /**
   * Aviso visible para el asesor cuando hay entregables en guión
   * (o el proceso está en esa fase) y aún no hay Diseñador DIDE.
   */
  const showAdvisorDesignerRequiredMessage = useMemo(() => {
    if (!isAdvisorRole(currentRole) || processHasDideDesigner) return false;
    if (isAdvisorGuideUploadStatus(detail.status)) return true;
    return groups.some((group) =>
      group.items.some((item) =>
        isAdvisorGuideUploadStatus(item.stateLabel),
      ),
    );
  }, [currentRole, processHasDideDesigner, detail.status, groups]);

  const selectedDeliverableStatus = useMemo(() => {
    if (!selectedDeliverable) return null;
    return getDeliverableUploadStatus(selectedDeliverable, detail.materials, {
      processStatus: detail.status,
    });
  }, [selectedDeliverable, detail.materials, detail.status]);

  const canUploadCurrentDeliverable = useMemo(() => {
    if (detail.isDeleted || detail.status === PROCESS_PHASES.COMPLETED) {
      return false;
    }
    if (!selectedDeliverable) return false;
    const isSyllabus = isSyllabusDeliverable(selectedDeliverable);

    // El líder de virtualización o el administrador cargan el syllabus.
    if (canUploadProcessSyllabus(currentRole)) {
      if (!isSyllabus) return false;
      if (needsValidatorForSyllabus) return false;
      return Boolean(selectedDeliverableStatus?.canUpload);
    }

    // Asesor: el guión se puede cargar aunque el diseñador DIDE aún no esté asignado.
    if (isAdvisorRole(currentRole)) {
      if (isSyllabus) return false;
      if (!isAdvisorGuideUploadStatus(selectedDeliverable.stateLabel)) {
        return false;
      }
      return Boolean(selectedDeliverableStatus?.canUpload);
    }

    // Autor: solo cargue de documentos / correcciones. Nunca guión instruccional.
    if (isAuthorRole(currentRole)) {
      // Mientras el proceso esté en cargue de syllabus, el autor no puede cargar
      if (isLeaderSyllabusStatus(detail.status)) return false;
      if (isSyllabus) return false;
      // Guión instruccional: solo el asesor pedagógico.
      if (isAdvisorGuideUploadStatus(selectedDeliverable.stateLabel)) {
        return false;
      }
      if (
        isAdvisorGuideUploadStatus(selectedDeliverableStatus?.label ?? "")
      ) {
        return false;
      }
      if (selectedDeliverableStatus?.canUpload) return true;

      const norm = normalizeFolderSegment(selectedDeliverable.stateLabel);
      const isReviewOrApproved =
        norm.includes("revis") ||
        norm.includes("validador") ||
        norm.includes("evaluador") || // compat. datos antiguos
        norm.includes("asesor") ||
        norm.includes("dide") ||
        norm.includes("audiovisual") ||
        norm.includes("enlaces audiovisuales") ||
        (norm.includes("registrar") && norm.includes("enlace")) ||
        norm.includes("aprobado") ||
        norm.includes("terminado") ||
        norm.includes("finalizado") ||
        norm.includes("guion") ||
        norm.includes("guia instruct");

      if (isReviewOrApproved) return false;

      return (
        // Evitar que "Cargar Guión..." coincida por la palabra "cargue/cargar".
        (norm.includes("cargue") &&
          !norm.includes("guion") &&
          !norm.includes("guia")) ||
        (norm.includes("autor") &&
          !norm.includes("guion") &&
          !norm.includes("guia")) ||
        norm.includes("pendiente") ||
        norm.includes("sin cargar") ||
        norm.includes("devuelto") ||
        norm.includes("corregir") ||
        norm.includes("no iniciado") ||
        norm.includes("noiniciado")
      );
    }

    return false;
  }, [
    selectedDeliverable,
    currentRole,
    selectedDeliverableStatus,
    detail.status,
    detail.isDeleted,
    needsValidatorForSyllabus,
  ]);

  const uploadButtonLabel = useMemo(() => {
    if (!selectedDeliverable) return "Cargar Material";
    if (isSyllabusDeliverable(selectedDeliverable)) return "Cargar syllabus";
    if (isAdvisorRole(currentRole)) return "Cargar guión instruccional";
    if (selectedDeliverableStatus?.kind === "returned") {
      return "Cargar corrección";
    }
    return "Cargar Material";
  }, [selectedDeliverable, selectedDeliverableStatus, currentRole]);

  // Mantener abierto el grupo del entregable seleccionado.
  useEffect(() => {
    if (!selectedDeliverable) return;
    setExpandedCredits((current) =>
      current.includes(selectedDeliverable.creditNumber)
        ? current
        : [...current, selectedDeliverable.creditNumber],
    );
    setExpandedCorrectionIds([]);
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
    setDetailTab("actual");

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
    deliverableName: selectedDeliverable?.name,
    deliverableStateLabel: selectedDeliverable?.stateLabel,
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

  const canApproveCurrent = detail.isDeleted
    ? false
    : hasDeliverables
      ? deliverableValidation.canApprove
      : Boolean(canApprove);

  const canReturnCurrent = detail.isDeleted
    ? false
    : hasDeliverables
      ? deliverableValidation.canReturn
      : Boolean(canReturn);

  const showValidationActions =
    canApproveCurrent || canReturnCurrent;

  const isAudiovisualApprovalPhase = selectedDeliverable
    ? isAdvisorAudiovisualApprovalStatus(selectedDeliverable.stateLabel)
    : false;

  /**
   * Documentos que cierran el entregable: última versión del autor, guión
   * instruccional y enlaces audiovisuales del diseñador DIDE.
   */
  const finalDocuments = useMemo(() => {
    const latestAuthor =
      scopedMaterials.find((material) => material.isAuthorUpload) ?? null;

    const advisorGuide =
      scopedMaterials.find((material) => isAdvisorGuideMaterial(material)) ??
      null;

    const dideLinks =
      scopedMaterials.find((material) => {
        if (!isDideLinksMaterial(material)) return false;
        return collectMaterialLinks(material).length > 0;
      }) ??
      scopedMaterials.find((material) => isDideLinksMaterial(material)) ??
      null;

    return { latestAuthor, advisorGuide, dideLinks };
  }, [scopedMaterials]);

  const correctionMaterials = useMemo(() => {
    return scopedMaterials
      .filter(isCorrectionMaterial)
      .sort(
        (a, b) =>
          new Date(
            movementCreatedOn(b.createdOn, b.modifiedOn) || 0,
          ).getTime() -
          new Date(
            movementCreatedOn(a.createdOn, a.modifiedOn) || 0,
          ).getTime(),
      );
  }, [scopedMaterials]);

  /** Última devolución (la más reciente). */
  const latestCorrection = correctionMaterials[0] ?? null;

  /**
   * Material a mostrar en "Actual":
   * - Si el entregable está devuelto → la última corrección.
   * - En cualquier otro caso → el registro más reciente del entregable.
   *   (La última versión del autor se consulta en "Versión final".)
   */
  const focusMaterialForActual = useMemo(() => {
    if (scopedMaterials.length === 0) return null;

    if (selectedDeliverableStatus?.kind === "returned" && latestCorrection) {
      return latestCorrection;
    }

    return scopedMaterials[0];
  }, [scopedMaterials, selectedDeliverableStatus?.kind, latestCorrection]);

  /**
   * Destino de aprobar/devolver (activityId para carpetas de corrección / AV).
   * Independiente de lo que se muestra como "último registro relevante".
   */
  const validationTargetMaterial = useMemo(() => {
    if (!showValidationActions) return null;

    if (isAudiovisualApprovalPhase) {
      return (
        finalDocuments.dideLinks ??
        scopedMaterials.find((material) => material.isAuthorUpload) ??
        focusMaterialForActual
      );
    }

    return (
      scopedMaterials.find((material) => material.isAuthorUpload) ??
      focusMaterialForActual
    );
  }, [
    showValidationActions,
    isAudiovisualApprovalPhase,
    finalDocuments.dideLinks,
    scopedMaterials,
    focusMaterialForActual,
  ]);

  const isActualShowingReturn =
    selectedDeliverableStatus?.kind === "returned" &&
    Boolean(latestCorrection) &&
    focusMaterialForActual?.activityId === latestCorrection?.activityId;

  useEffect(() => {
    if (detailTab !== "actual") return;
    if (!focusMaterialForActual) return;
    if (selectedMaterialId === focusMaterialForActual.activityId) return;
    setSelectedMaterial(focusMaterialForActual.activityId);
  }, [
    detailTab,
    focusMaterialForActual?.activityId,
    selectedMaterialId,
  ]);

  const detailTabs = useMemo(() => {
    const tabs: Array<{
      id: DeliverableDetailTab;
      label: string;
      count?: number;
      icon: typeof IoFlashOutline;
    }> = [
      {
        id: "actual",
        label: "Actual",
        icon: IoFlashOutline,
      },
      {
        id: "corrections",
        label: "Correcciones",
        count: correctionMaterials.length,
        icon: IoReturnDownBackOutline,
      },
      {
        id: "history",
        label: "Historial",
        count: scopedMaterials.length,
        icon: IoTimeOutline,
      },
      {
        id: "documents",
        label: "Versión Final",
        icon: IoDocumentTextOutline,
      },
    ];
    return tabs;
  }, [correctionMaterials.length, scopedMaterials.length]);

  const processInfoItems = [
    { label: "Proceso de virtualización", value: detail.processName },
    { label: "ID del proceso", value: detail.processId },
    { label: "Curso", value: detail.courseName },
    { label: "Programa", value: detail.programName },
    { label: "Facultad", value: detail.facultyName },
    // Responsables del proceso (líder, autor, validador, asesor).
    ...detail.assignedRoles.map((assigned) => {
      const email = assigned.email.trim();
      const storedName = assigned.name.trim();
      const directoryName =
        directoryNames[email.toLowerCase()]?.trim() ?? "";
      const name =
        storedName && storedName.toLowerCase() !== email.toLowerCase()
          ? storedName
          : directoryName;
      const showEmail =
        Boolean(email) &&
        Boolean(name) &&
        name.toLowerCase() !== email.toLowerCase();
      return {
        label: formatDomainLabel(assigned.role),
        value: showEmail ? name : name || email,
        detail: showEmail ? email : undefined,
      };
    }),
  ];

  const showClassroomStatus = isLeaderClassroomConfirmStatus(detail.status);
  const classroomStatusLabel = formatDomainLabel(
    PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM,
  );

  const deliverableCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  const toggleCorrectionExpanded = (activityId: string) => {
    setExpandedCorrectionIds((current) =>
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId],
    );
    setSelectedMaterial(activityId);
  };

  return {
    groups,
    groupsLoading,
    groupsError,
    selectedDeliverableId,
    expandedCredits,
    detailTab,
    setDetailTab,
    expandedCorrectionIds,
    setExpandedCorrectionIds,
    selectedMaterialId,
    hasDeliverables,
    selectedDeliverable,
    currentRole,
    processHasValidator,
    processHasDideDesigner,
    needsValidatorForSyllabus,
    needsDesignerForGuide,
    showAdvisorDesignerRequiredMessage,
    selectedDeliverableStatus,
    canUploadCurrentDeliverable,
    uploadButtonLabel,
    toggleCreditGroup,
    scopedMaterials,
    setSelectedMaterial,
    handleSelectDeliverable,
    selectedMaterial,
    validationContext,
    canApproveCurrent,
    canReturnCurrent,
    showValidationActions,
    isAudiovisualApprovalPhase,
    finalDocuments,
    correctionMaterials,
    latestCorrection,
    focusMaterialForActual,
    validationTargetMaterial,
    isActualShowingReturn,
    detailTabs,
    processInfoItems,
    showClassroomStatus,
    classroomStatusLabel,
    deliverableCount,
    toggleCorrectionExpanded,
  };
}
