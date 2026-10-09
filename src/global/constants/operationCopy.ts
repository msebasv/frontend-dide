/**
 * Textos formales para soft-timeout, toast de progreso y conflictos de operación.
 * Tono institucional (aplicación académica / administrativa).
 * Evitar punto y coma en mensajes visibles.
 */

export const OPERATION_COPY = {
  pendingDefaultTitle: "Solicitud en procesamiento",
  pendingDefaultMessage:
    "La solicitud fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",

  toastPendingDefaultTitle: "Procesamiento en curso",
  toastPendingDefaultMessage:
    "La solicitud continúa en segundo plano. Puede seguir utilizando la aplicación. El resultado se mostrará en este aviso.",

  busyConflictDefaultTitle: "Operación en curso",
  busyConflictDefaultMessage:
    "Hay una solicitud en procesamiento. Espere a que finalice antes de iniciar otra.",

  pendingConfirmLabel: "Continuar",
  toastDismissLabel: "Aceptar",

  softTimeoutFallback: (actionLabel: string) =>
    `La ${actionLabel} fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.`,

  softTimeoutGeneric:
    "La solicitud permanece en procesamiento y aún no ha sido confirmada. El sistema notificará el resultado al concluir.",

  leaveWhilePending:
    "Hay una solicitud en procesamiento. Si cierra esta pestaña, no recibirá el aviso de si terminó bien o con error.",

  backgroundFailedDefault:
    "No fue posible confirmar el resultado en el tiempo esperado. Verifique el estado en el detalle. Si el cambio ya aparece, no envíe de nuevo. De lo contrario, intente más tarde o contacte al administrador.",

  uploadLockedTitle: "Carga en procesamiento para este entregable",
  uploadLockedLabel: "Carga en procesamiento…",
} as const;

/** Mensajes del modal informativo de procesamiento y del toast por tipo de acción. */
export const PENDING_ACTION_COPY = {
  createProcess: {
    pendingTitle: "Creación del proceso en curso",
    pendingMessage:
      "La creación del proceso fue registrada y permanece en procesamiento, incluidas fases y roles. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Creando proceso de virtualización",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
  },
  createCourse: {
    pendingTitle: "Creación del curso en curso",
    pendingMessage:
      "La creación del curso fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Creando curso",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
  },
  updateProcess: {
    pendingTitle: "Actualización del proceso en curso",
    pendingMessage:
      "La actualización fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Actualizando proceso",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
  },
  assignValidator: {
    pendingTitle: "Asignación de validador en curso",
    pendingMessage:
      "La asignación del validador disciplinar fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Asignando validador disciplinar",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
  },
  assignDesigner: {
    pendingTitle: "Asignación de diseñador en curso",
    pendingMessage:
      "La asignación del diseñador DIDE fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Asignando diseñador DIDE",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
  },
  uploadMaterial: {
    pendingTitle: "Carga de material en curso",
    pendingMessage:
      "La carga del material fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Cargando material",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
    busyConflictMessage:
      "Hay una carga de material en procesamiento. Espere a que finalice antes de iniciar otra.",
  },
  uploadGuide: {
    pendingTitle: "Carga del guión en curso",
    pendingMessage:
      "La carga del guión instruccional fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Cargando guión instruccional",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
    busyConflictMessage:
      "Hay una carga u otra solicitud en procesamiento. Espere a que finalice antes de continuar.",
  },
  approveMaterial: {
    pendingTitle: "Aprobación en curso",
    pendingMessage:
      "La aprobación fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Procesando aprobación",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
    busyConflictMessage:
      "Hay una aprobación o devolución en procesamiento. Espere a que finalice antes de iniciar otra solicitud.",
  },
  designerUpload: {
    pendingTitle: "Registro de cargue en curso",
    pendingMessage:
      "El registro del cargue fue enviado y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Registrando cargue",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
    busyConflictMessage:
      "Hay una aprobación o devolución en procesamiento. Espere a que finalice antes de iniciar otra solicitud.",
  },
  returnMaterial: {
    pendingTitle: "Devolución en curso",
    pendingMessage:
      "La devolución fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Procesando devolución",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
    busyConflictMessage:
      "Hay una aprobación o devolución en procesamiento. Espere a que finalice antes de iniciar otra solicitud.",
  },
  confirmClassroom: {
    pendingTitle: "Confirmación de aula en curso",
    pendingMessage:
      "La confirmación del cargue en el aula fue registrada y permanece en procesamiento. El sistema notificará el resultado al concluir.",
    toastPendingTitle: "Confirmando cargue en el aula",
    toastPendingMessage: OPERATION_COPY.toastPendingDefaultMessage,
    busyConflictMessage:
      "Hay una solicitud en procesamiento. Espere a que finalice antes de confirmar el cargue en el aula.",
  },
} as const;
