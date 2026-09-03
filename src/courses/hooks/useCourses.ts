/**
 * Hook de listado de cursos asignados al usuario.
 *
 * Carga procesos filtrados por email + rol activo y calcula métricas del dashboard.
 */
import { useState, useCallback } from "react";

import { getCoursesForUser } from "../services/courseService";
import { computeMetrics } from "../mappers/courseMappers";

import type { Course, DashboardMetrics } from "../types/course.types";

export const useCourses = (userEmail: string, userRole: string) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total: 0,
    inProgress: 0,
    pendingApproval: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(false);

  const loadCourses = useCallback(async () => {
    if (!userEmail || !userRole) return;

    try {
      setLoading(true);
      const data = await getCoursesForUser(userEmail, userRole);
      setCourses(data);
      setMetrics(computeMetrics(data));
    } catch (error) {
      console.error("Error cargando cursos", error);
    } finally {
      setLoading(false);
    }
  }, [userEmail, userRole]);

  return { courses, metrics, loading, loadCourses };
};
