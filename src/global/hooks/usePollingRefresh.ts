/**
 * Refresco ligero: al volver a la pestaña/ventana y, opcionalmente,
 * un intervalo largo solo mientras la pestaña está visible.
 */
import { useEffect } from "react";

export const usePollingRefresh = (
  refresh: () => void | Promise<void>,
  /** Intervalo en ms; `0` o negativo desactiva el polling periódico. */
  intervalMs = 60_000,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", tick);

    const id =
      intervalMs > 0 ? window.setInterval(tick, intervalMs) : undefined;

    return () => {
      if (id != null) window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", tick);
    };
  }, [refresh, intervalMs, enabled]);
};
