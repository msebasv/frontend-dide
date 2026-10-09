/**
 * Hook de detalle de un proceso de virtualización.
 * Usado en viewCourse y viewProcess para mostrar materiales y metadatos.
 */
import { useState, useCallback, useRef } from "react";

import { getCourseDetail } from "../services/courseService";
import type { CourseDetail } from "../types/course.types";

export const useCourseDetail = () => {
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const loadDetail = useCallback(
    async (
      processId: string,
      options?: { refresh?: boolean; includeInactive?: boolean },
    ) => {
      const requestId = ++requestRef.current;
      const refresh = options?.refresh === true;

      if (!refresh) {
        setLoading(true);
        setDetail(null);
      }

      try {
        const data = await getCourseDetail(processId, {
          includeInactive: options?.includeInactive,
        });
        if (requestRef.current !== requestId) return;
        setDetail(data);
      } catch {
        if (requestRef.current === requestId && !refresh) {
          setDetail(null);
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [],
  );

  return { detail, loading, loadDetail };
};
