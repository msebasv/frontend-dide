/**
 * Aviso de que una acción larga ya terminó, con éxito o con error.
 * El detalle y el seguimiento se recargan al escucharlo.
 */
export const OPERATION_SETTLED_EVENT = "academicplus:operation-settled";

export const notifyOperationSettled = (): void => {
  window.dispatchEvent(new Event(OPERATION_SETTLED_EVENT));
};
