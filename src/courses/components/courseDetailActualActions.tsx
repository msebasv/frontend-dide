import {
  IoCheckmarkCircle,
  IoCloudUploadOutline,
  IoPersonOutline,
  IoReturnDownBackOutline,
} from "react-icons/io5";
import { Link } from "react-router-dom";
import clsx from "clsx";

import Button from "../../global/components/button";
import { useActionFeedback } from "../../global/hooks/useActionFeedback";
import { OPERATION_COPY } from "../../global/constants/operationCopy";
import {
  canAssignDideDesigner,
  isLeaderRole,
} from "../../global/constants/domainConstants";
import {
  isAdvisorRole,
  isDideDesignerRole,
  isVirtualizationLeaderRole,
} from "../mappers/courseMappers";
import { isSyllabusDeliverable } from "../services/deliverableService";
import type { ProcessDeliverableItem } from "../services/deliverableService";
import type { CourseMaterial } from "../types/course.types";
import type { MaterialValidationContext } from "./courseDetailViewHelpers";

export interface CourseDetailActualActionsProps {
  selectedDeliverable: ProcessDeliverableItem;
  currentRole: string;
  needsDesignerForGuide: boolean;
  canUploadCurrentDeliverable: boolean;
  showValidationActions: boolean;
  needsValidatorForSyllabus: boolean;
  processHasDideDesigner: boolean;
  scopedMaterialsLength: number;
  selectedDeliverableStatusDetailMessage?: string;
  uploadButtonLabel: string;
  actionsDisabled: boolean;
  processId: string;
  canReturnCurrent: boolean;
  canApproveCurrent: boolean;
  isAudiovisualApprovalPhase: boolean;
  validationTargetMaterial: CourseMaterial | null;
  onGuideUploadRequest?: (context: {
    deliverableId: string;
    deliverableName: string;
  }) => void;
  onApproveRequest?: (context: MaterialValidationContext) => void;
  onReturnRequest?: (context: MaterialValidationContext) => void;
  validationContext: (material: CourseMaterial) => MaterialValidationContext;
}

export function CourseDetailActualActions({
  selectedDeliverable,
  currentRole,
  needsDesignerForGuide,
  canUploadCurrentDeliverable,
  showValidationActions,
  needsValidatorForSyllabus,
  processHasDideDesigner,
  scopedMaterialsLength,
  selectedDeliverableStatusDetailMessage,
  uploadButtonLabel,
  actionsDisabled,
  processId,
  canReturnCurrent,
  canApproveCurrent,
  isAudiovisualApprovalPhase,
  validationTargetMaterial,
  onGuideUploadRequest,
  onApproveRequest,
  onReturnRequest,
  validationContext,
}: CourseDetailActualActionsProps) {
  const { pendingResourceLock } = useActionFeedback();
  const advisorNeedsDesigner =
    needsDesignerForGuide && isAdvisorRole(currentRole);

  const uploadLockedForDeliverable =
    pendingResourceLock?.processId === processId &&
    pendingResourceLock?.deliverableId === selectedDeliverable.id;
  const uploadDisabled = actionsDisabled || uploadLockedForDeliverable;

  const hasPrimaryAction =
    canUploadCurrentDeliverable ||
    showValidationActions ||
    needsValidatorForSyllabus ||
    advisorNeedsDesigner ||
    (canAssignDideDesigner(currentRole) && !processHasDideDesigner);

  if (!hasPrimaryAction && scopedMaterialsLength > 0) {
    return (
      <div className="rounded-lg border border-border bg-acacia-5/60 px-4 py-3">
        <p className="text-sm font-semibold text-primary">
          Sin acciones pendientes en este entregable
        </p>
        <p className="mt-1 text-xs text-muted">
          Consulte el registro más reciente o las pestañas Correcciones e
          Historial para más detalle.
        </p>
      </div>
    );
  }

  const actionMessage = advisorNeedsDesigner
    ? "La carga del guión instruccional requiere la previa asignación del Diseñador DIDE por parte del Coordinador de Diseñadores."
    : selectedDeliverableStatusDetailMessage;

  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Acciones disponibles
      </p>
      {actionMessage ? (
        <p
          className={clsx(
            "mt-1 text-xs",
            advisorNeedsDesigner
              ? "font-medium text-amber-900"
              : "text-muted",
          )}
        >
          {actionMessage}
        </p>
      ) : null}

      {advisorNeedsDesigner ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
          Hasta completar dicha asignación, la carga del guión de este
          entregable permanecerá bloqueada.
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {canUploadCurrentDeliverable && (
            <>
              {isAdvisorRole(currentRole) && onGuideUploadRequest ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={uploadDisabled}
                  title={
                    uploadLockedForDeliverable
                      ? OPERATION_COPY.uploadLockedTitle
                      : undefined
                  }
                  onClick={() =>
                    onGuideUploadRequest({
                      deliverableId: selectedDeliverable.id,
                      deliverableName: selectedDeliverable.name,
                    })
                  }
                >
                  <IoCloudUploadOutline size={16} />
                  {uploadLockedForDeliverable
                    ? OPERATION_COPY.uploadLockedLabel
                    : uploadButtonLabel}
                </Button>
              ) : uploadLockedForDeliverable ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled
                  title={OPERATION_COPY.uploadLockedTitle}
                >
                  <IoCloudUploadOutline size={16} />
                  {OPERATION_COPY.uploadLockedLabel}
                </Button>
              ) : (
                <Link
                  to={`/courses/${processId}/upload`}
                  state={{ deliverableId: selectedDeliverable.id }}
                >
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={actionsDisabled}
                  >
                    <IoCloudUploadOutline size={16} />
                    {uploadButtonLabel}
                  </Button>
                </Link>
              )}
            </>
          )}

          {showValidationActions && validationTargetMaterial && (
            <>
              {canReturnCurrent && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={actionsDisabled}
                  onClick={() =>
                    onReturnRequest?.(
                      validationContext(validationTargetMaterial),
                    )
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
                    onApproveRequest?.(
                      validationContext(validationTargetMaterial),
                    )
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
            </>
          )}

          {needsValidatorForSyllabus &&
            isSyllabusDeliverable(selectedDeliverable) &&
            (isVirtualizationLeaderRole(currentRole) ||
              isLeaderRole(currentRole)) && (
              <Link
                to={`/virtualization-processes/${processId}/assign-validator`}
              >
                <Button variant="primary" size="sm">
                  <IoPersonOutline size={16} />
                  Asignar validador
                </Button>
              </Link>
            )}

          {canAssignDideDesigner(currentRole) && !processHasDideDesigner && (
            <Link
              to={`/virtualization-processes/${processId}/assign-designer`}
            >
              <Button variant="primary" size="sm">
                <IoPersonOutline size={16} />
                Asignar diseñador
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
