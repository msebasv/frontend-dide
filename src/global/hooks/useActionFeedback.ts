/**
 * Re-export del feedback global de acciones.
 * El estado y el modal viven en ActionFeedbackProvider (sobrevive a la navegación).
 */
export {
  useActionFeedback,
  type RunActionOptions,
} from "../providers/actionFeedbackProvider";
