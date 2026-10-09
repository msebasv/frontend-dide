import {
  IoCheckmarkCircle,
  IoChevronDownOutline,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoLinkOutline,
  IoOpenOutline,
  IoPersonOutline,
  IoReturnDownBackOutline,
  IoTimeOutline,
} from "react-icons/io5";
import clsx from "clsx";

import Button from "../../global/components/button";
import InfoCard from "../../global/components/infoCard";
import LoadingState from "../../global/components/loadingState";
import { ElapsedDaysBadge } from "../../global/components/elapsedDaysBadge";
import ProcessDeliverablesFilesPanel from "../../global/components/processDeliverablesFilesPanel";
import { ProcessStatus } from "../../processVirtualization/components/processStatus";
import {
  deliverableElapsedDayCount,
  formatHistoryStepElapsed,
  movementElapsedDays,
} from "../../global/utils/colombiaBusinessDays";
import { formatDateTime } from "../../global/utils/dateUtils";
import { stripHttpLinksFromText } from "../../global/utils/inputValidation";
import { formatDomainLabel } from "../../global/utils/textUtils";
import { PROCESS_PHASES, isLeaderRole } from "../../global/constants/domainConstants";
import {
  formatActivityStatus,
  isAdvisorGuideUploadStatus,
  isAdvisorRole,
  isDideDesignerRole,
  isVirtualizationLeaderRole,
} from "../mappers/courseMappers";
import {
  formatDeliverableSharePointLocation,
  isSyllabusDeliverable,
  materialBelongsToDeliverable,
} from "../services/deliverableService";
import type { CourseDetail, CourseMaterial } from "../types/course.types";
import { exportDeliverableHistoryPdf } from "../utils/exportDeliverableHistoryPdf";
import { CourseDetailActivityList } from "./courseDetailActivityList";
import { CourseDetailActualActions } from "./courseDetailActualActions";
import { CourseDetailDeliverablesPanel } from "./courseDetailDeliverablesPanel";
import { CourseDetailFinalDocuments } from "./courseDetailFinalDocuments";
import {
  actorLabel,
  collectMaterialLinkEntries,
  commentsLabel,
  isAdvisorGuideMaterial,
  isDideLinksMaterial,
  materialStatusStyle,
  type MaterialValidationContext,
} from "./courseDetailViewHelpers";
import { useCourseDetailView } from "./useCourseDetailView";

export type { MaterialValidationContext } from "./courseDetailViewHelpers";

interface CourseDetailViewProps {
  detail: CourseDetail;
  isValidationMode?: boolean;
  /** Mostrar botón Aprobar / Cargar (validador/asesor/DIDE). */
  canApprove?: boolean;
  /** Mostrar botón Devolver (validador/asesor; no DIDE). */
  canReturn?: boolean;
  actionsDisabled?: boolean;
  selectedMaterialId?: string;
  onSelectedMaterialChange?: (activityId: string) => void;
  onApproveRequest?: (context: MaterialValidationContext) => void;
  onReturnRequest?: (context: MaterialValidationContext) => void;
  /**
   * Asesor en "Cargar Guión instruccional": abre el modal de Word
   * en lugar de ir a la página de cargue del autor.
   */
  onGuideUploadRequest?: (context: {
    deliverableId: string;
    deliverableName: string;
  }) => void;
  /**
   * Líder de virtualización: confirmar cargue en el aula (cierre del proceso).
   */
  canConfirmClassroom?: boolean;
  onConfirmClassroomRequest?: () => void;
}

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
  onGuideUploadRequest,
  canConfirmClassroom = false,
  onConfirmClassroomRequest,
}: CourseDetailViewProps) {
  const {
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
    focusMaterialForActual,
    validationTargetMaterial,
    isActualShowingReturn,
    detailTabs,
    processInfoItems,
    showClassroomStatus,
    classroomStatusLabel,
    deliverableCount,
  } = useCourseDetailView({
    detail,
    canApprove,
    canReturn,
    selectedMaterialId: controlledMaterialId,
    onSelectedMaterialChange,
  });

  const renderMaterialDetail = (
    material: CourseMaterial,
    options?: { showActions?: boolean },
  ) => {
    const includeActions = options?.showActions !== false;
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
              className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-semibold ${materialStatusStyle(statusLabel)}`}
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
            {(() => {
              const dideLinksActivity = isDideLinksMaterial(material);
              const linkEntries = dideLinksActivity
                ? collectMaterialLinkEntries(material)
                : [];
              const notes = dideLinksActivity
                ? stripHttpLinksFromText(material.description)
                : "";

              if (dideLinksActivity && linkEntries.length > 0) {
                return (
                  <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-acacia-5/80 px-3.5 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <IoLinkOutline size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                          Enlaces audiovisuales DIDE
                        </p>
                        <p className="text-[11px] text-muted">
                          Registrados por el Diseñador DIDE
                        </p>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-2">
                      {linkEntries.map((entry, index) => (
                        <li key={`${entry.url}-${index}`}>
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-2 rounded-lg border border-primary/20 bg-white/90 px-3 py-2 text-sm text-primary transition hover:border-primary/40 hover:bg-white hover:shadow-sm"
                          >
                            <IoOpenOutline
                              size={15}
                              className="mt-0.5 shrink-0 text-primary/70 group-hover:text-primary"
                            />
                            <span className="min-w-0 space-y-0.5">
                              {entry.label ? (
                                <span className="block font-semibold text-primary">
                                  {entry.label}
                                </span>
                              ) : null}
                              <span className="block break-all font-medium underline-offset-2 group-hover:underline">
                                {entry.url}
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>

                    {notes ? (
                      <div className="mt-3 rounded-lg border border-border/60 bg-white/70 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          Notas adicionales
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-muted">
                          {notes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <>
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
                </>
              );
            })()}
          </div>
        </div>

        {includeActions && showValidationActions && (
          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {isAudiovisualApprovalPhase
                ? "Decisión sobre el material audiovisual"
                : "Decisión sobre este material"}
            </p>
            {selectedDeliverable && (
              <p className="mt-1 text-xs text-muted">
                Entregable:{" "}
                <span className="font-medium text-primary">
                  {selectedDeliverable.name}
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
                  {isAudiovisualApprovalPhase
                    ? "Aprobar material audiovisual"
                    : isDideDesignerRole(currentRole)
                      ? "Cargar"
                      : "Aprobar"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const selectedDeliverableElapsed = (() => {
    if (!selectedDeliverable) return null;
    const syllabusItem = groups
      .flatMap((group) => group.items)
      .find((item) => isSyllabusDeliverable(item));
    const syllabusDates = syllabusItem
      ? detail.materials
          .filter((material) =>
            materialBelongsToDeliverable(material, syllabusItem),
          )
          .map((material) => material.createdOn || material.modifiedOn)
          .filter(Boolean)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      : [];
    const related = detail.materials.filter((material) =>
      materialBelongsToDeliverable(material, selectedDeliverable),
    );
    const latest = [...related].sort(
      (a, b) =>
        new Date(b.createdOn || b.modifiedOn || 0).getTime() -
        new Date(a.createdOn || a.modifiedOn || 0).getTime(),
    )[0];
    const latestStatus = latest ? formatActivityStatus(latest.status) : "";
    const returned = /devuelto|corregir|no aprobado/i.test(latestStatus);
    const eventDates = related
      .map((material) => material.createdOn || material.modifiedOn)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return deliverableElapsedDayCount({
      isSyllabus: isSyllabusDeliverable(selectedDeliverable),
      returned,
      eventDates,
      processCreatedOn: detail.createdOn,
      syllabusCompletedOn: isSyllabusDeliverable(selectedDeliverable)
        ? undefined
        : syllabusDates[0],
    });
  })();

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {detail.status === PROCESS_PHASES.COMPLETED && (
        <div className="rounded-xl border border-[#86c127]/35 bg-[#86c127]/10 px-4 py-3 text-sm font-semibold text-[#3f8f2a]">
          Proceso finalizado
        </div>
      )}

      {showAdvisorDesignerRequiredMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Asignación de Diseñador DIDE requerida</p>
          <p className="mt-1 text-xs text-amber-900/80">
            La carga del guión instruccional está condicionada a que el
            Coordinador de Diseñadores asigne el Diseñador DIDE a este proceso.
          </p>
        </div>
      )}

      {(canConfirmClassroom || showClassroomStatus) && (
        <div className="flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-cyan-950">
                {classroomStatusLabel}
              </p>
              <ProcessStatus status={PROCESS_PHASES.LEADER_CLASSROOM_CONFIRM} />
            </div>
            <p className="mt-0.5 text-xs text-cyan-900/80">
              {canConfirmClassroom
                ? "Las categorías obligatorias están completas. Proceda a confirmar el cargue en el aula para cerrar el proceso."
                : "Pendiente de confirmación del cargue en el aula por parte del líder de virtualización."}
            </p>
          </div>
          {canConfirmClassroom && (
            <Button
              size="sm"
              className="shrink-0"
              disabled={actionsDisabled}
              onClick={() => onConfirmClassroomRequest?.()}
            >
              <IoCheckmarkCircle size={16} />
              Confirmar Cargue en el Aula
            </Button>
          )}
        </div>
      )}

      <InfoCard
        title="Información del proceso"
        items={processInfoItems}
        collapsible
        defaultOpen={false}
        compact
      />

      {groupsLoading ? (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
          <LoadingState message="Cargando entregables del proceso..." />
        </div>
      ) : hasDeliverables ? (
        <>
          <div className="grid min-w-0 max-w-full gap-4 lg:grid-cols-12 lg:items-start lg:gap-6">
            <CourseDetailDeliverablesPanel
              groups={groups}
              materials={detail.materials}
              deliverableCount={deliverableCount}
              processCreatedOn={detail.createdOn}
              expandedCredits={expandedCredits}
              selectedDeliverableId={selectedDeliverableId}
              onToggleCreditGroup={toggleCreditGroup}
              onSelectDeliverable={handleSelectDeliverable}
            />

            <div className="min-w-0 max-w-full lg:col-span-8">
              <div className="flex h-[min(32rem,58dvh)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:h-[min(36rem,65dvh)]">
                <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-primary">
                          {selectedDeliverable
                            ? selectedDeliverable.name
                            : "Detalle del entregable"}
                        </h3>
                        {selectedDeliverable && (
                          <span
                            className={clsx(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                              selectedDeliverable.isRequired
                                ? "bg-primary/10 text-primary"
                                : "bg-gray-100 text-muted",
                            )}
                          >
                            {selectedDeliverable.isRequired
                              ? "Obligatorio"
                              : "Opcional"}
                          </span>
                        )}
                        {selectedDeliverable && (
                          <ProcessStatus
                            status={selectedDeliverable.stateLabel}
                          />
                        )}
                      </div>
                      {selectedDeliverable && (
                        <div className="mt-1.5">
                          <ElapsedDaysBadge
                            days={selectedDeliverableElapsed ?? 0}
                          />
                        </div>
                      )}
                    </div>

                    {selectedDeliverable && (
                      <Button
                        variant="secondary"
                        className="!py-1.5 !px-3 !text-xs font-semibold gap-1.5 shadow-sm"
                        disabled={actionsDisabled}
                        onClick={() =>
                          exportDeliverableHistoryPdf({
                            detail,
                            deliverable: selectedDeliverable,
                            deliverableLocation:
                              formatDeliverableSharePointLocation(
                                selectedDeliverable,
                              ),
                            materials: scopedMaterials,
                          })
                        }
                      >
                        <IoDownloadOutline size={16} />
                        Exportar PDF
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {detailTabs.map((tab) => {
                      const isActive = detailTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDetailTab(tab.id)}
                          className={clsx(
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                            isActive
                              ? "bg-primary text-white shadow-sm"
                              : "bg-white text-muted ring-1 ring-border hover:text-primary",
                          )}
                        >
                          <Icon size={14} className="shrink-0 opacity-90" />
                          <span>{tab.label}</span>
                          {typeof tab.count === "number" ? (
                            <span
                              className={clsx(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {tab.count}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                {detailTab === "actual" && (
                  <div className="space-y-4 p-3 sm:p-5">
                    {selectedDeliverable ? (
                      <CourseDetailActualActions
                        selectedDeliverable={selectedDeliverable}
                        currentRole={currentRole}
                        needsDesignerForGuide={needsDesignerForGuide}
                        canUploadCurrentDeliverable={canUploadCurrentDeliverable}
                        showValidationActions={showValidationActions}
                        needsValidatorForSyllabus={needsValidatorForSyllabus}
                        processHasDideDesigner={processHasDideDesigner}
                        scopedMaterialsLength={scopedMaterials.length}
                        selectedDeliverableStatusDetailMessage={
                          selectedDeliverableStatus?.detailMessage
                        }
                        uploadButtonLabel={uploadButtonLabel}
                        actionsDisabled={actionsDisabled}
                        processId={detail.processId}
                        canReturnCurrent={canReturnCurrent}
                        canApproveCurrent={canApproveCurrent}
                        isAudiovisualApprovalPhase={isAudiovisualApprovalPhase}
                        validationTargetMaterial={validationTargetMaterial}
                        onGuideUploadRequest={onGuideUploadRequest}
                        onApproveRequest={onApproveRequest}
                        onReturnRequest={onReturnRequest}
                        validationContext={validationContext}
                      />
                    ) : null}

                    {focusMaterialForActual ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                            {isActualShowingReturn
                              ? "Última devolución"
                              : "Último registro relevante"}
                          </p>
                          {isActualShowingReturn ? (
                            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                              Pendiente de corrección
                            </span>
                          ) : null}
                        </div>
                        {isActualShowingReturn ? (
                          <p className="text-xs text-muted">
                            Consulte los comentarios de esta devolución. El
                            historial completo se encuentra en la pestaña
                            Correcciones.
                          </p>
                        ) : null}
                        {renderMaterialDetail(focusMaterialForActual, {
                          showActions: false,
                        })}
                      </div>
                    ) : scopedMaterials.length === 0 &&
                      needsValidatorForSyllabus &&
                      selectedDeliverable &&
                      isSyllabusDeliverable(selectedDeliverable) &&
                      (isVirtualizationLeaderRole(currentRole) ||
                        isLeaderRole(currentRole)) ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <IoPersonOutline size={26} />
                        </div>
                        <div className="max-w-sm space-y-1">
                          <p className="text-sm font-semibold text-amber-950">
                            Asignación de validador disciplinar requerida
                          </p>
                          <p className="text-xs text-amber-900/80">
                            La carga del syllabus requiere la previa asignación
                            del validador disciplinar.
                          </p>
                        </div>
                      </div>
                    ) : scopedMaterials.length === 0 &&
                      needsDesignerForGuide &&
                      selectedDeliverable &&
                      isAdvisorGuideUploadStatus(
                        selectedDeliverable.stateLabel,
                      ) &&
                      isAdvisorRole(currentRole) ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <IoPersonOutline size={26} />
                        </div>
                        <div className="max-w-sm space-y-1">
                          <p className="text-sm font-semibold text-amber-950">
                            Asignación de Diseñador DIDE requerida
                          </p>
                          <p className="text-xs text-amber-900/80">
                            La carga del guión instruccional requiere la previa
                            asignación del Diseñador DIDE por parte del
                            Coordinador de Diseñadores.
                          </p>
                        </div>
                      </div>
                    ) : scopedMaterials.length === 0 &&
                      canUploadCurrentDeliverable &&
                      selectedDeliverable ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <IoCloudUploadOutline size={26} />
                        </div>
                        <div className="max-w-sm space-y-1">
                          <p className="text-sm font-semibold text-primary">
                            Entregable pendiente de cargue
                          </p>
                          <p className="text-xs text-muted">
                            {isSyllabusDeliverable(selectedDeliverable)
                              ? "Como líder de virtualización, puede cargar el syllabus para iniciar el flujo de revisión."
                              : isAdvisorRole(currentRole)
                                ? "Como asesor pedagógico, puede adjuntar el guión instruccional en Word o PDF para este entregable."
                                : "Como autor del curso, puede cargar los documentos correspondientes a este entregable."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center gap-2">
                        <IoDocumentTextOutline
                          className="text-gray-300"
                          size={32}
                        />
                        <p className="text-sm text-muted">
                          No hay registros asociados a este entregable
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === "corrections" && (
                  <div className="space-y-3 p-3 sm:p-5">
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        Historial de correcciones
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Listado de devoluciones del entregable, de la más
                        reciente a la más antigua. Despliegue cada corrección
                        para consultar el detalle. La devolución vigente, si
                        existe, también se presenta en la pestaña Actual.
                      </p>
                    </div>

                    {correctionMaterials.length === 0 ? (
                      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border">
                        <IoCheckmarkCircle
                          className="text-gray-300"
                          size={32}
                        />
                        <p className="text-sm text-muted">
                          No se registran correcciones para este entregable
                        </p>
                      </div>
                    ) : (
                      <ol className="space-y-4">
                        {correctionMaterials.map((material, index) => {
                          const correctionElapsed = movementElapsedDays(
                            correctionMaterials.map((item) => ({
                              id: item.activityId,
                              at: item.createdOn || item.modifiedOn,
                            })),
                          );
                          const correctionDays = correctionElapsed.get(
                            material.activityId,
                          );
                          const newestCorrectionId = [...correctionMaterials].sort(
                            (a, b) =>
                              new Date(b.createdOn || b.modifiedOn || 0).getTime() -
                              new Date(a.createdOn || a.modifiedOn || 0).getTime(),
                          )[0]?.activityId;
                          const statusLabel = formatActivityStatus(
                            material.status,
                          );
                          const phaseLabel = formatDomainLabel(
                            material.name || statusLabel,
                          );
                          const isExpanded = expandedCorrectionIds.includes(
                            material.activityId,
                          );
                          const isLatest = index === 0;
                          const commentPreview =
                            material.description?.trim() ||
                            "Sin comentarios registrados.";

                          const toggleExpanded = () => {
                            setExpandedCorrectionIds((current) =>
                              current.includes(material.activityId)
                                ? current.filter(
                                    (id) => id !== material.activityId,
                                  )
                                : [...current, material.activityId],
                            );
                            setSelectedMaterial(material.activityId);
                          };

                          return (
                            <li
                              key={material.activityId}
                              className={clsx(
                                "overflow-hidden rounded-xl border-2 bg-white shadow-sm",
                                isLatest
                                  ? "border-[#DC2626]/35"
                                  : "border-border",
                              )}
                            >
                              <div className="flex items-stretch gap-0">
                                <div
                                  className={clsx(
                                    "w-1.5 shrink-0",
                                    isLatest ? "bg-[#DC2626]" : "bg-primary/25",
                                  )}
                                  aria-hidden
                                />
                                <div className="min-w-0 flex-1 px-4 py-3.5">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-xl border border-[#DC2626]/25 bg-[#DC2626]/10 px-2 py-0.5 text-[10px] font-bold text-[#DC2626]">
                                          Corrección #
                                          {correctionMaterials.length - index}
                                        </span>
                                        {isLatest ? (
                                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                            Más reciente
                                          </span>
                                        ) : null}
                                        <span
                                          className={`inline-flex rounded-xl px-2 py-0.5 text-[11px] font-semibold ${materialStatusStyle(statusLabel)}`}
                                        >
                                          {statusLabel}
                                        </span>
                                      </div>
                                      <p className="text-sm font-semibold text-primary">
                                        {phaseLabel}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                                          <IoTimeOutline size={12} />
                                          {formatDateTime(
                                            material.modifiedOn ||
                                              material.createdOn,
                                          )}
                                        </p>
                                        {correctionDays != null ? (
                                          <span
                                            className={clsx(
                                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                              material.activityId ===
                                                newestCorrectionId
                                                ? "bg-primary/10 text-primary"
                                                : "bg-gray-100 text-muted",
                                            )}
                                          >
                                            {formatHistoryStepElapsed(
                                              correctionDays,
                                              material.activityId ===
                                                newestCorrectionId,
                                            )}
                                          </span>
                                        ) : null}
                                      </div>
                                      {!isExpanded ? (
                                        <p className="line-clamp-2 whitespace-pre-line text-xs text-muted">
                                          {commentPreview}
                                        </p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={toggleExpanded}
                                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-acacia-5/80 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition hover:border-primary/30 hover:bg-primary/5"
                                      aria-expanded={isExpanded}
                                    >
                                      <IoChevronDownOutline
                                        size={14}
                                        className={clsx(
                                          "transition-transform",
                                          isExpanded ? "rotate-180" : "rotate-0",
                                        )}
                                      />
                                      {isExpanded
                                        ? "Ocultar detalle"
                                        : "Ver detalle"}
                                    </button>
                                  </div>

                                  {isExpanded ? (
                                    <div className="mt-3 border-t border-border pt-3">
                                      {renderMaterialDetail(material, {
                                        showActions: false,
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                )}

                {detailTab === "history" && (
                  <div className="grid min-h-full gap-0 lg:grid-cols-5">
                    <div className="border-b border-border lg:col-span-2 lg:border-b-0 lg:border-r">
                      <CourseDetailActivityList
                        materials={scopedMaterials}
                        hasDeliverables={hasDeliverables}
                        selectedMaterialId={selectedMaterialId}
                        onSelectMaterial={setSelectedMaterial}
                        showElapsed
                      />
                    </div>
                    <div className="min-w-0 p-3 sm:p-5 lg:col-span-3">
                      {selectedMaterial ? (
                        renderMaterialDetail(selectedMaterial)
                      ) : (
                        <div className="flex h-56 flex-col items-center justify-center gap-2">
                          <IoDocumentTextOutline
                            className="text-gray-300"
                            size={32}
                          />
                          <p className="text-sm text-muted">
                            {scopedMaterials.length === 0
                              ? "No se registran actividades en este entregable"
                              : "Seleccione una actividad"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === "documents" && (
                  <div className="p-3 sm:p-4">
                    <CourseDetailFinalDocuments
                      embedded
                      selectedDeliverable={selectedDeliverable}
                      selectedMaterialId={selectedMaterialId}
                      onSelectMaterial={setSelectedMaterial}
                      finalDocuments={finalDocuments}
                    />
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          <ProcessDeliverablesFilesPanel
            processId={detail.processId}
            folderBase={detail.folderBase}
            activityId={selectedMaterial?.activityId}
            selectedDeliverable={selectedDeliverable}
            includeGuideFolderFallback={
              selectedMaterial
                ? isAdvisorGuideMaterial(selectedMaterial)
                : false
            }
            hideNavigator
            audiovisualLinks={
              selectedMaterial && isDideLinksMaterial(selectedMaterial)
                ? collectMaterialLinkEntries(selectedMaterial)
                : []
            }
            audiovisualNotes={
              selectedMaterial && isDideLinksMaterial(selectedMaterial)
                ? stripHttpLinksFromText(selectedMaterial.description)
                : undefined
            }
          />
        </>
      ) : (
        <>
          {groupsError && (
            <p className="rounded-lg border border-border bg-acacia-5 px-4 py-2 text-xs text-muted">
              {groupsError} Se muestran las actividades generales del proceso.
            </p>
          )}

          <div className="grid min-w-0 max-w-full gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
            <div className="flex h-[min(32rem,58dvh)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-1 lg:h-[min(36rem,65dvh)]">
              <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
                <h3 className="text-sm font-semibold text-primary">
                  Actividades del proceso
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {detail.materials.length}
                  </span>
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {isValidationMode
                    ? "Seleccione la actividad a revisar. Las acciones de aprobación o devolución aplican únicamente a ese material."
                    : "Cargas del autor (con versión) y revisiones del proceso, de la más reciente a la más antigua."}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <CourseDetailActivityList
                  materials={detail.materials}
                  hasDeliverables={hasDeliverables}
                  selectedMaterialId={selectedMaterialId}
                  onSelectMaterial={setSelectedMaterial}
                />
              </div>
            </div>

            <div className="flex h-[min(32rem,58dvh)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] lg:col-span-2 lg:h-[min(36rem,65dvh)]">
              <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-3.5">
                <h3 className="text-sm font-semibold text-primary">
                  Detalle del material
                </h3>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                {selectedMaterial ? (
                  renderMaterialDetail(selectedMaterial)
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-2">
                    <IoDocumentTextOutline className="text-gray-300" size={32} />
                    <p className="text-sm text-muted">
                      Seleccione un material para revisarlo
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
            includeGuideFolderFallback={
              selectedMaterial
                ? isAdvisorGuideMaterial(selectedMaterial)
                : false
            }
          />
        </>
      )}
    </div>
  );
}

export default CourseDetailView;
