import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import clsx from "clsx";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";

import PageHeader from "../../global/components/pageHeader";
import LoadingState from "../../global/components/loadingState";
import FormField from "../../global/components/formField";
import InputText from "../../global/components/inputText";
import TextArea from "../../global/components/textArea";
import FileUpload from "../../global/components/fileUpload";
import Select, { type SelectOption } from "../../global/components/select";
import Button from "../../global/components/button";
import FormBusyOverlay from "../../global/components/formBusyOverlay";
import InfoCard from "../../global/components/infoCard";
import FeedbackModal from "../../global/components/feedbackModal";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { useAuth } from "../../global/hooks/useAuth";
import { formatDomainLabel } from "../../global/utils/textUtils";
import {
  FIELD_LIMITS,
  validateDescription,
  validateFiles,
  validateTitle,
} from "../../global/utils/inputValidation";

import { useCourseDetail } from "../hooks/useCourseDetail";
import { uploadCourseMaterial } from "../services/courseService";
import {
  filterDeliverablesForUpload,
  formatDeliverableUploadLabel,
  getDeliverableUploadStatus,
  isSyllabusDeliverable,
  listProcessDeliverableGroups,
  type DeliverableUploadStatusInfo,
  type ProcessDeliverableItem,
} from "../services/deliverableService";
import {
  isAuthorRole,
  isLeaderSyllabusStatus,
  isVirtualizationLeaderRole,
} from "../mappers/courseMappers";
import { isLeaderRole } from "../../global/constants/domainConstants";

type ScopeType = "general" | "credit";

const UploadCourse = () => {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole } = useAuth();
  const { detail, loading, loadDetail } = useCourseDetail();
  const { feedback, closeFeedback, runAction } = useActionFeedback();

  const [resourceName, setResourceName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deliverables, setDeliverables] = useState<ProcessDeliverableItem[]>([]);
  const [deliverablesLoading, setDeliverablesLoading] = useState(true);
  const [deliverablesError, setDeliverablesError] = useState("");

  // Selectores de ámbito y crédito
  const [selectedScope, setSelectedScope] = useState<ScopeType>("general");
  const [selectedCreditNumber, setSelectedCreditNumber] = useState<number>(1);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState("");
  const [hideUploaded, setHideUploaded] = useState(false);

  const isLeaderUpload =
    isVirtualizationLeaderRole(currentRole) ||
    (isLeaderRole(currentRole) &&
      Boolean(detail && isLeaderSyllabusStatus(detail.status)));

  const backTo = location.pathname.includes("/virtualization-processes/")
    ? `/virtualization-processes/${processId}`
    : isLeaderUpload
      ? `/virtualization-processes/${processId}`
      : `/courses/${processId}`;

  // Estado de carga de cada entregable basado en las actividades del proceso
  const deliverableStatusMap = useMemo(() => {
    const map = new Map<string, DeliverableUploadStatusInfo>();
    const materials = detail?.materials ?? [];
    for (const item of deliverables) {
      map.set(item.id, getDeliverableUploadStatus(item, materials));
    }
    return map;
  }, [deliverables, detail?.materials]);

  // Créditos disponibles en los entregables del proceso
  const availableCreditNumbers = useMemo(() => {
    const numbers = deliverables
      .filter((item) => item.creditNumber > 0)
      .map((item) => item.creditNumber);
    return Array.from(new Set(numbers)).sort((a, b) => a - b);
  }, [deliverables]);

  const hasGeneralDeliverables = useMemo(
    () => deliverables.some((item) => item.creditNumber === 0),
    [deliverables],
  );
  const hasCreditDeliverables = availableCreditNumbers.length > 0;

  // Opciones para el selector de Ámbito (General / Por crédito)
  const scopeOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [];
    if (hasGeneralDeliverables) {
      list.push({ value: "general", label: "General" });
    }
    if (hasCreditDeliverables) {
      list.push({ value: "credit", label: "Por crédito" });
    }
    return list;
  }, [hasGeneralDeliverables, hasCreditDeliverables]);

  const selectedScopeOption =
    scopeOptions.find((opt) => opt.value === selectedScope) ?? scopeOptions[0] ?? null;

  // Opciones para el selector de Crédito
  const creditOptions: SelectOption[] = useMemo(() => {
    return availableCreditNumbers.map((num) => ({
      value: String(num),
      label: `Crédito / Unidad ${num}`,
    }));
  }, [availableCreditNumbers]);

  const selectedCreditOption =
    creditOptions.find((opt) => opt.value === String(selectedCreditNumber)) ??
    creditOptions[0] ??
    null;

  // Entregables acotados al ámbito y crédito activos
  const scopedDeliverables = useMemo(() => {
    if (isLeaderUpload) return deliverables;
    if (selectedScope === "general") {
      return deliverables.filter((item) => item.creditNumber === 0);
    }
    return deliverables.filter(
      (item) => item.creditNumber === selectedCreditNumber,
    );
  }, [deliverables, isLeaderUpload, selectedScope, selectedCreditNumber]);

  // Entregables con su información de estado de carga
  const scopedWithStatus = useMemo(() => {
    return scopedDeliverables.map((item) => {
      const status = deliverableStatusMap.get(item.id) ?? {
        kind: "pending" as const,
        canUpload: true,
        label: "Pendiente",
        badgeText: "Pendiente",
        badgeVariant: "neutral" as const,
        detailMessage: "Disponible para carga.",
      };
      return { item, status };
    });
  }, [scopedDeliverables, deliverableStatusMap]);

  // ¿Todos los entregables de este ámbito ya están cargados/en revisión/aprobados?
  const allScopedLoaded =
    !isLeaderUpload &&
    scopedWithStatus.length > 0 &&
    scopedWithStatus.every((s) => !s.status.canUpload);

  const hasAnyUploadableDeliverable = useMemo(() => {
    if (deliverables.length === 0) return false;
    if (isLeaderUpload) {
      const syllabus =
        deliverables.find(isSyllabusDeliverable) ?? deliverables[0];
      if (!syllabus) return false;
      const status = deliverableStatusMap.get(syllabus.id);
      return status ? status.canUpload : true;
    }

    return deliverables.some((item) => {
      const status = deliverableStatusMap.get(item.id);
      return status ? status.canUpload : true;
    });
  }, [isLeaderUpload, deliverables, deliverableStatusMap]);

  // Opciones del selector de material (con badges visuales y bloqueo de duplicados)
  const deliverableOptions: SelectOption[] = useMemo(() => {
    const list = hideUploaded
      ? scopedWithStatus.filter((s) => s.status.canUpload)
      : scopedWithStatus;

    return list.map(({ item, status }) => ({
      value: item.id,
      label: item.name,
      disabled: !status.canUpload,
      badge: {
        text: status.badgeText,
        variant: status.badgeVariant,
      },
    }));
  }, [scopedWithStatus, hideUploaded]);

  // Para el líder, si selectedDeliverableId aún no se ha seteado, busca el entregable de Syllabus
  const effectiveDeliverableId = useMemo(() => {
    if (selectedDeliverableId) return selectedDeliverableId;
    if (isLeaderUpload) {
      const syllabus =
        deliverables.find(isSyllabusDeliverable) ?? deliverables[0];
      return syllabus?.id ?? "";
    }
    return "";
  }, [selectedDeliverableId, isLeaderUpload, deliverables]);

  const selectedDeliverableOption =
    deliverableOptions.find(
      (option) => option.value === effectiveDeliverableId,
    ) ?? null;

  const selectedDeliverable =
    deliverables.find((item) => item.id === effectiveDeliverableId) ?? null;

  const selectedDeliverableStatus = effectiveDeliverableId
    ? deliverableStatusMap.get(effectiveDeliverableId) ?? null
    : null;

  const canUploadSelected = isLeaderUpload
    ? Boolean(effectiveDeliverableId)
    : Boolean(effectiveDeliverableId) &&
      Boolean(selectedDeliverableStatus?.canUpload);

  const resourceNameCheck = validateTitle(
    resourceName ||
      (isLeaderUpload ? selectedDeliverable?.name || "Syllabus" : ""),
    {
      label: "El nombre del recurso",
    },
  );
  const descriptionCheck = validateDescription(description, {
    label: "La descripción",
  });
  const filesCheck = validateFiles(files, { required: true });

  const formIsValid =
    resourceNameCheck.ok &&
    descriptionCheck.ok &&
    filesCheck.ok &&
    Boolean(processId) &&
    canUploadSelected;

  useEffect(() => {
    if (processId) void loadDetail(processId);
  }, [processId, loadDetail]);

  useEffect(() => {
    let cancelled = false;

    const loadDeliverables = async () => {
      if (!processId) {
        setDeliverables([]);
        setDeliverablesLoading(false);
        return;
      }

      try {
        setDeliverablesLoading(true);
        setDeliverablesError("");
        const groups = await listProcessDeliverableGroups(processId);
        if (cancelled) return;

        // Líder: solo el entregable Syllabus (por nombre).
        // Autor: resto de entregables (Guión general, por crédito, etc.).
        const available = filterDeliverablesForUpload(groups, {
          syllabusOnly: isLeaderUpload,
        });
        setDeliverables(available);

        // Preselección inteligente: si viene preseleccionado desde una categoría, usarlo;
        // de lo contrario, buscar el primer entregable pendiente o devuelto
        const stateDeliverableId = (
          location.state as { deliverableId?: string } | null
        )?.deliverableId;
        const requestedDeliverable = stateDeliverableId
          ? available.find((item) => item.id === stateDeliverableId)
          : null;

        const firstUploadable =
          requestedDeliverable ??
          available.find((item) => {
            const st = getDeliverableUploadStatus(
              item,
              detail?.materials || [],
            );
            return st.canUpload;
          }) ?? available[0];

        setSelectedDeliverableId((prev) => {
          if (
            prev &&
            !stateDeliverableId &&
            available.some((item) => item.id === prev)
          ) {
            return prev;
          }
          if (firstUploadable) {
            if (firstUploadable.creditNumber === 0) {
              setSelectedScope("general");
            } else {
              setSelectedScope("credit");
              setSelectedCreditNumber(firstUploadable.creditNumber);
            }
            setResourceName(firstUploadable.name);
            return firstUploadable.id;
          }
          return "";
        });

        if (isLeaderUpload && available.length === 0) {
          setDeliverablesError(
            "No se encontró un entregable llamado Syllabus en este proceso.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error cargando entregables para carga", error);
          setDeliverablesError(
            "No se pudieron cargar los entregables disponibles para este proceso.",
          );
          setDeliverables([]);
        }
      } finally {
        if (!cancelled) setDeliverablesLoading(false);
      }
    };

    void loadDeliverables();
    return () => {
      cancelled = true;
    };
  }, [processId, isLeaderUpload, detail?.materials]);

  const handleScopeChange = (option: SelectOption | null) => {
    const nextScope = (option?.value as ScopeType) ?? "general";
    setSelectedScope(nextScope);

    const targetCredit = nextScope === "general" ? 0 : selectedCreditNumber;
    const candidates = deliverables.filter(
      (d) => d.creditNumber === targetCredit,
    );
    const firstAvailable =
      candidates.find((d) => {
        const st = deliverableStatusMap.get(d.id);
        return st?.canUpload;
      }) ?? candidates[0];

    if (firstAvailable) {
      setSelectedDeliverableId(firstAvailable.id);
      setResourceName(firstAvailable.name);
    } else {
      setSelectedDeliverableId("");
      setResourceName("");
    }
  };

  const handleCreditChange = (option: SelectOption | null) => {
    const nextCredit = Number(option?.value) || 1;
    setSelectedCreditNumber(nextCredit);

    const candidates = deliverables.filter(
      (d) => d.creditNumber === nextCredit,
    );
    const firstAvailable =
      candidates.find((d) => {
        const st = deliverableStatusMap.get(d.id);
        return st?.canUpload;
      }) ?? candidates[0];

    if (firstAvailable) {
      setSelectedDeliverableId(firstAvailable.id);
      setResourceName(firstAvailable.name);
    } else {
      setSelectedDeliverableId("");
      setResourceName("");
    }
  };

  const handleSelectDeliverable = (option: SelectOption | null) => {
    const nextId = option?.value ?? "";
    setSelectedDeliverableId(nextId);

    const item = deliverables.find((deliverable) => deliverable.id === nextId);
    if (item) {
      setResourceName(item.name);
    }
  };

  const handleSubmit = async () => {
    if (
      !formIsValid ||
      !processId ||
      !canUploadSelected ||
      !effectiveDeliverableId
    )
      return;

    try {
      setSubmitting(true);
      await runAction(
        () =>
          uploadCourseMaterial({
            activityName: resourceNameCheck.value,
            description: descriptionCheck.value,
            processId,
            files: filesCheck.files,
            deliverableId: effectiveDeliverableId,
          }),
        {
          successTitle: "Material cargado",
          successMessage: isLeaderUpload
            ? "El syllabus se cargó correctamente. El proceso pasó al autor de asignatura."
            : "El recurso académico se cargó correctamente y quedó disponible para revisión.",
          errorTitle: "No se pudo cargar el material",
          errorMessage:
            "Verifica los datos e intenta nuevamente. Si el problema persiste, contacta al administrador.",
          onSuccessClose: () =>
            navigate(backTo, {
              replace: true,
              state: { fromUpload: true },
            }),
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !detail || deliverablesLoading) {
    return <LoadingState message="Cargando información del curso..." />;
  }

  const canRoleUpload =
    isAuthorRole(currentRole) ||
    isVirtualizationLeaderRole(currentRole) ||
    isLeaderRole(currentRole);

  if (!canRoleUpload) {
    return (
      <div>
        <PageHeader
          title="Cargar Material"
          description="Acceso no disponible"
          backTo={backTo}
        />
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted">
            Tu rol actual ({formatDomainLabel(currentRole)}) no tiene permisos
            para cargar materiales en este proceso.
          </p>
          <Link to={backTo}>
            <Button variant="primary" size="sm">
              Volver
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (
    isAuthorRole(currentRole) &&
    isLeaderSyllabusStatus(detail.status)
  ) {
    return (
      <div>
        <PageHeader
          title="Cargar Material"
          description="Cargue de syllabus pendiente"
          backTo={backTo}
        />
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted">
            Este proceso aún está en fase de cargue de syllabus. Cuando el líder
            complete esa entrega, podrás cargar el material académico.
          </p>
          <Link to={backTo}>
            <Button variant="primary" size="sm">
              Volver al detalle
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <div>
        <PageHeader
          title="Cargar Material"
          description="Sin entregables disponibles"
          backTo={backTo}
        />
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted">
            {deliverablesError ||
              "No se encontraron entregables configurados para este proceso."}
          </p>
          <Link to={backTo}>
            <Button variant="primary" size="sm">
              Volver
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!hasAnyUploadableDeliverable) {
    return (
      <div>
        <PageHeader
          title={isLeaderUpload ? "Cargar syllabus" : "Cargar Material"}
          description={
            isLeaderUpload
              ? "El syllabus de este proceso ya ha sido cargado."
              : "Todos los materiales de este proceso ya han sido cargados o se encuentran en revisión."
          }
          backTo={backTo}
        />
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <FaCheckCircle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-primary">
              {isLeaderUpload
                ? "El syllabus ya fue cargado"
                : "No tienes materiales pendientes de carga"}
            </h3>
            <p className="text-sm text-muted">
              {isLeaderUpload
                ? "El syllabus de este proceso ya se encuentra registrado y en avance del flujo."
                : "Todos los entregables asignados a tu rol para este proceso ya han sido enviados o se encuentran en revisión. Puedes hacer seguimiento al estado de cada categoría en el detalle del curso."}
            </p>
          </div>
          <Link to={backTo}>
            <Button variant="primary" size="sm">
              Ver detalle del proceso
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isLeaderUpload ? "Cargar syllabus" : "Cargar Material"}
        description={
          isLeaderUpload
            ? "El líder de virtualización solo puede cargar el syllabus de este proceso"
            : "Selecciona el crédito o ámbito general y el material correspondiente para cargar."
        }
        backTo={backTo}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <InfoCard
          title="Curso seleccionado"
          items={[
            { label: "Proceso de virtualización", value: detail.processName },
            { label: "Curso", value: detail.courseName },
            { label: "Programa", value: detail.programName },
            { label: "Facultad", value: detail.facultyName },
          ]}
        />

        <FormBusyOverlay
          busy={submitting}
          message="Cargando material..."
          className="w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-border bg-gradient-to-r from-secondary/5 to-transparent px-6 py-4 sm:px-8">
            <h2 className="text-base font-semibold text-primary">
              Formulario de carga
            </h2>
          </div>

          <div className="space-y-5 p-4 sm:p-6 md:p-8">
            {isLeaderUpload ? (
              <FormField
                label="Tipo de material"
                required
                hint="Cargue de syllabus inicial del proceso."
                error={
                  deliverablesError ||
                  (!deliverables.length
                    ? "No hay un entregable Syllabus en este proceso."
                    : undefined)
                }
              >
                <InputText
                  value={
                    selectedDeliverable
                      ? formatDeliverableUploadLabel(selectedDeliverable)
                      : "Syllabus no encontrado"
                  }
                  onChange={() => undefined}
                  disabled
                />
              </FormField>
            ) : (
              <>
                {/* 1. Selección de Ámbito (General vs Por crédito) y Crédito */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Ámbito de entrega"
                    required
                    hint="Elige si el material aplica de forma general o por unidad de crédito."
                  >
                    <Select
                      options={scopeOptions}
                      value={selectedScopeOption}
                      onChange={handleScopeChange}
                      placeholder="Selecciona el ámbito"
                      disabled={submitting || scopeOptions.length <= 1}
                    />
                  </FormField>

                  {selectedScope === "credit" && (
                    <FormField
                      label="Crédito / Unidad"
                      required
                      hint="Selecciona el crédito al cual pertenece el material."
                    >
                      <Select
                        options={creditOptions}
                        value={selectedCreditOption}
                        onChange={handleCreditChange}
                        placeholder="Selecciona el crédito"
                        disabled={submitting || creditOptions.length === 0}
                      />
                    </FormField>
                  )}
                </div>

                {/* 2. Selector del Material específico */}
                <FormField
                  label="Material a cargar"
                  required
                  hint="Los materiales ya cargados o aprobados se muestran bloqueados para evitar entregas duplicadas."
                  error={
                    deliverablesError ||
                    (!deliverables.length
                      ? "No hay entregables configurados en este proceso."
                      : undefined)
                  }
                >
                  <Select
                    options={deliverableOptions}
                    value={selectedDeliverableOption}
                    onChange={handleSelectDeliverable}
                    placeholder={
                      allScopedLoaded
                        ? "Todos los materiales de este ámbito ya están cargados"
                        : "Selecciona el material a cargar"
                    }
                    disabled={
                      submitting ||
                      deliverableOptions.length === 0 ||
                      allScopedLoaded
                    }
                  />
                </FormField>

                {/* Alerta si todos los materiales del ámbito están listos */}
                {allScopedLoaded && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950">
                    <FaCheckCircle
                      className="mt-0.5 shrink-0 text-emerald-600"
                      size={18}
                    />
                    <div className="text-xs">
                      <p className="font-semibold">
                        Todos los materiales de{" "}
                        {selectedScope === "general"
                          ? "General"
                          : `Crédito ${selectedCreditNumber}`}{" "}
                        ya están cargados
                      </p>
                      <p className="mt-0.5 text-emerald-800">
                        Los entregables de esta sección ya fueron enviados y se
                        encuentran en revisión o aprobados. Si alguno es devuelto
                        por el validador disciplinar, se habilitará automáticamente aquí
                        para su nueva entrega.
                      </p>
                    </div>
                  </div>
                )}

                {/* Alerta informativa si el material seleccionado fue devuelto */}
                {selectedDeliverableStatus?.kind === "returned" && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                    <FaExclamationTriangle
                      className="mt-0.5 shrink-0 text-amber-600"
                      size={18}
                    />
                    <div className="text-xs">
                      <p className="font-semibold">
                        Material devuelto para corrección
                      </p>
                      <p className="mt-0.5 text-amber-900">
                        {selectedDeliverableStatus.latestMaterial?.description
                          ? `Observaciones del validador disciplinar: "${selectedDeliverableStatus.latestMaterial.description}"`
                          : "Adjunta la versión corregida de este recurso académico para reanudar su validación."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Alerta si el material ya fue cargado previamente */}
                {selectedDeliverableStatus?.kind === "in_review" && (
                  <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                    <FaInfoCircle
                      className="mt-0.5 shrink-0 text-blue-600"
                      size={18}
                    />
                    <div className="text-xs">
                      <p className="font-semibold">
                        Material ya cargado (en revisión)
                      </p>
                      <p className="mt-0.5 text-blue-800">
                        Este recurso ya fue entregado y se encuentra actualmente
                        en proceso de revisión. No es posible duplicar el cargue
                        hasta recibir la retroalimentación del validador disciplinar.
                      </p>
                    </div>
                  </div>
                )}

                {/* Resumen visual de materiales de la sección */}
                {scopedWithStatus.length > 0 && (
                  <div className="space-y-2.5 rounded-xl border border-border bg-gray-50/50 p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-primary">
                        Materiales de{" "}
                        {selectedScope === "general"
                          ? "General"
                          : `Crédito ${selectedCreditNumber}`}{" "}
                        ({scopedWithStatus.length})
                      </p>
                      <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={hideUploaded}
                          onChange={(e) => setHideUploaded(e.target.checked)}
                          className="rounded border-border text-primary focus:ring-secondary/30"
                        />
                        <span>Ocultar ya cargados</span>
                      </label>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {scopedWithStatus.map(({ item, status }) => {
                        const isSelected = item.id === selectedDeliverableId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (status.canUpload) {
                                handleSelectDeliverable({
                                  value: item.id,
                                  label: item.name,
                                });
                              }
                            }}
                            disabled={!status.canUpload}
                            className={clsx(
                              "flex flex-col justify-between rounded-xl border p-3 text-left transition",
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : status.canUpload
                                  ? "cursor-pointer border-border bg-white hover:border-primary/40 hover:bg-white/80"
                                  : "cursor-not-allowed border-border-light bg-gray-100/70 opacity-70",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 text-xs font-semibold text-primary">
                                {item.name}
                              </span>
                              <span
                                className={clsx(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  status.badgeVariant === "success" &&
                                    "bg-emerald-100 text-emerald-800",
                                  status.badgeVariant === "warning" &&
                                    "bg-amber-100 text-amber-900",
                                  status.badgeVariant === "info" &&
                                    "bg-blue-100 text-blue-800",
                                  (!status.badgeVariant ||
                                    status.badgeVariant === "neutral") &&
                                    "bg-gray-100 text-gray-700",
                                )}
                              >
                                {status.badgeText}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-1 text-[11px] text-muted">
                              {status.label}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <FormField
              label="Nombre del recurso"
              required
              error={
                resourceName.trim() ? resourceNameCheck.message : undefined
              }
              hint={
                isLeaderUpload
                  ? "Este cargue registra el syllabus del proceso."
                  : "Nombre del material (ej. Guía de estudio, Guión de recurso educativo)."
              }
            >
              <InputText
                value={resourceName}
                onChange={setResourceName}
                placeholder="Nombre del recurso"
                maxLength={FIELD_LIMITS.title}
                invalid={Boolean(resourceName.trim() && !resourceNameCheck.ok)}
                disabled={submitting}
              />
            </FormField>

            <FormField
              label="Descripción del recurso"
              error={description.trim() ? descriptionCheck.message : undefined}
              hint="Describe brevemente el contenido. Se permiten letras, números, guiones, comillas y puntuación habitual."
            >
              <TextArea
                value={description}
                onChange={setDescription}
                placeholder="Descripción (opcional)"
                maxLength={FIELD_LIMITS.description}
                invalid={Boolean(description.trim() && !descriptionCheck.ok)}
                disabled={submitting}
              />
            </FormField>

            <FormField
              label="Archivos"
              required
              hint="Puedes adjuntar uno o varios archivos en la misma entrega."
            >
              <FileUpload
                files={files}
                onChange={setFiles}
                required
                disabled={submitting}
              />
            </FormField>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
              <Button
                variant="secondary"
                onClick={() => navigate(backTo)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !formIsValid || !canUploadSelected}
              >
                {isLeaderUpload ? "Cargar syllabus" : "Cargar Material"}
              </Button>
            </div>
          </div>
        </FormBusyOverlay>
      </div>

      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
        confirmLabel={feedback.type === "success" ? "Continuar" : "Entendido"}
      />
    </div>
  );
};

export default UploadCourse;
