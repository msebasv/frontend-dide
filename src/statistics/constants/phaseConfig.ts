/**
 * Configuración de fases para el módulo de estadísticas.
 * Reutiliza colores y nombres del dominio central.
 */
import { processStatusColors } from "../../processVirtualization/constants/processStatusStyles";
import {
  PHASE_DISTRIBUTION_ORDER,
  PHASE_SHORT_LABELS,
  PROCESS_PHASES,
} from "../../global/constants/domainConstants";

/** Metadatos de fase (clave, etiqueta, color) para gráficas de estadísticas. */
export const PHASE_STATS_CONFIG = PHASE_DISTRIBUTION_ORDER.map((phaseKey) => ({
  key: phaseKey,
  label: PHASE_SHORT_LABELS[phaseKey] ?? phaseKey,
  color: processStatusColors[phaseKey],
}));

/** Clave de fase usada para contar procesos finalizados. */
export const COMPLETED_STATUS = PROCESS_PHASES.COMPLETED;
