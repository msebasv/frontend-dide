/**
 * Hook de detalle de un proceso de virtualización.
 * Usado en viewCourse y viewProcess para mostrar materiales y metadatos.
 */
import { useState, useCallback } from "react";

import { getCourseDetail } from "../services/courseService";
import type { CourseDetail } from "../types/course.types";

export const useCourseDetail = () => {
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetail = useCallback(async (processId: string) => {
    try {
      setLoading(true);
      setDetail(null);
      const data = await getCourseDetail(processId);
      setDetail(data);
    } catch (error) {
      console.error("Error cargando detalle del curso", error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { detail, loading, loadDetail };
};
