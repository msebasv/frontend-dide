import { useEffect, useMemo, useState } from "react";
import {
  IoDocumentTextOutline,
  IoFlashOutline,
  IoReturnDownBackOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { formatDomainLabel } from "../../global/utils/textUtils";
import { useAuth } from "../../global/hooks/useAuth";
import {
  canCreateOrEditProcesses,
  isLeaderRole,
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
  isVirtualizationLeaderRole,
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

export interface UseCourseDetailViewParams {
  detail: CourseDetail;
  canApprove?: boolean;
  canReturn?: boolean;
  selectedMaterialId?: string;
  onSelectedMaterialChange?: (activityId: string) => void;
}

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

  /** Solo bloquea al asesor en la fase de guión si falta el diseñador. */
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
    if (detail.status === PROCESS_PHASES.COMPLETED) return false;
    if (!selectedDeliverable) return false;
    const isSyllabus = isSyllabusDeliverable(selectedDeliverable);

    // Líder de virtualización carga el syllabus (solo si ya hay validador)
    if (
      isVirtualizationLeaderRole(currentRole) ||
      (isLeaderRole(currentRole) && canCreateOrEditProcesses(currentRole))
    ) {
      if (!isSyllabus) return false;
      if (needsValidatorForSyllabus) return false;
      return Boolean(selectedDeliverableStatus?.canUpload);
    }

    // Asesor: solo en "Cargar Guión instruccional" de ESE entregable.
    if (isAdvisorRole(currentRole)) {
      if (isSyllabus) return false;
      if (!isAdvisorGuideUploadStatus(selectedDeliverable.stateLabel)) {
        return false;
      }
      if (needsDesignerForGuide) return false;
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
        norm.includes("validador") ||
        norm.includes("evaluador") || // compat. datos antiguos
        norm.includes("asesor") ||
        norm.includes("dide") ||
        norm.includes("audiovisual") ||
        norm.includes("enlaces audiovisuales") ||
        (norm.includes("registrar") && norm.includes("enlace")) ||
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
  }, [
    selectedDeliverable,
    currentRole,
    selectedDeliverableStatus,
    detail.status,
    needsValidatorForSyllabus,
    needsDesignerForGuide,
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

  const canApproveCurrent = hasDeliverables
    ? deliverableValidation.canApprove
    : Boolean(canApprove);

  const canReturnCurrent = hasDeliverables
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
          new Date(b.modifiedOn || b.createdOn || 0).getTime() -
          new Date(a.modifiedOn || a.createdOn || 0).getTime(),
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
    { label: "Curso", value: detail.courseName },
    { label: "Programa", value: detail.programName },
    { label: "Facultad", value: detail.facultyName },
    // Responsables del proceso (líder, autor, validador, asesor).
    ...detail.assignedRoles.map((assigned) => ({
      label: formatDomainLabel(assigned.role),
      value: assigned.name || assigned.email,
    })),
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
