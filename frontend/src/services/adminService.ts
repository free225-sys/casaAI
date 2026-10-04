import { api } from "./apiClient";
import type {
  AdminCertification,
  AdminCertificationListResponse,
  AdminCertificationRequirement,
  AdminCertificationRequirementInput,
  AdminCourse,
  AdminLearnerProgressDetail,
  AdminLearnerProgressSummary,
  AdminLesson,
  AdminLessonListItem,
  AdminQuiz,
  AdminQuizInput,
  AdminQuizListResponse,
  AdminScopeReplacement,
  AdminScopes,
  AdminUser,
  LessonDocument,
  MediaUploadResult,
  Page,
  PdfImportResult,
  PdfPreviewResult,
} from "../types/api";

export const adminService = {
  // --- Utilisateurs ---------------------------------------------------
  listUsers: (params: { search?: string; role?: string; status?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    if (params.status) q.set("status", params.status);
    q.set("limit", String(params.limit ?? 20));
    q.set("offset", String(params.offset ?? 0));
    return api.get<Page<AdminUser>>(`/api/admin/users?${q.toString()}`, true);
  },
  updateUser: (id: string, data: { role?: string; status?: string }) =>
    api.patch<AdminUser>(`/api/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete<void>(`/api/admin/users/${id}`),

  // --- Cours -----------------------------------------------------------
  listCourses: (params: { status?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    q.set("limit", String(params.limit ?? 50));
    q.set("offset", String(params.offset ?? 0));
    return api.get<Page<AdminCourse>>(`/api/admin/courses?${q.toString()}`, true);
  },
  getCourse: (id: string) => api.get<AdminCourse>(`/api/admin/courses/${id}`, true),
  /** `pathway_id` : rattachement atomique à un parcours, autorisé à la création seulement (le serveur refuse un PUT avec parcours). */
  createCourse: (data: Partial<AdminCourse> & { pathway_id?: string | null }) => api.post<AdminCourse>("/api/admin/courses", data, true),
  updateCourse: (id: string, data: Partial<AdminCourse>) => api.put<AdminCourse>(`/api/admin/courses/${id}`, data),
  deleteCourse: (id: string) => api.delete<void>(`/api/admin/courses/${id}`),

  // --- Périmètres (Lot 2) : attribution école/parcours, remplacement atomique par le SUPER_ADMIN -----
  getMyScopes: () => api.get<AdminScopes>("/api/admin/me/scopes", true),
  getUserScopes: (userId: string) => api.get<AdminScopes>(`/api/admin/users/${userId}/scopes`, true),
  setUserScopes: (userId: string, data: AdminScopeReplacement) => api.put<AdminScopes>(`/api/admin/users/${userId}/scopes`, data),

  // --- Aperçus d'administration (Lot 4) : lecture seule, soumis au périmètre, sans suivi ni tentative ni badge ----
  previewLesson: (id: string) => api.get<AdminLesson>(`/api/admin/preview/lessons/${id}`, true),
  previewLessonDocument: (id: string) => api.get<LessonDocument>(`/api/admin/preview/lessons/${id}/document`, true),
  previewQuiz: (id: string) => api.get<AdminQuiz>(`/api/admin/preview/quizzes/${id}`, true),

  // --- Leçons -----------------------------------------------------------
  listLessons: (courseId: string) =>
    api.get<Page<AdminLessonListItem>>(`/api/admin/lessons?course_id=${courseId}&limit=100`, true),
  getLesson: (id: string) => api.get<AdminLesson>(`/api/admin/lessons/${id}`, true),
  createLesson: (data: Partial<AdminLesson>) => api.post<AdminLesson>("/api/admin/lessons", data, true),
  updateLesson: (id: string, data: Partial<AdminLesson>) => api.put<AdminLesson>(`/api/admin/lessons/${id}`, data),
  deleteLesson: (id: string) => api.delete<void>(`/api/admin/lessons/${id}`),

  // --- Import PDF -----------------------------------------------------------
  /** `target` : école et parcours autorisés, exigés par le serveur pour un ADMIN ; sans effet pour un SUPER_ADMIN. */
  previewPdf: (file: File, target?: { schoolId?: string; pathwayId?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (target?.schoolId) form.append("school_id", target.schoolId);
    if (target?.pathwayId) form.append("pathway_id", target.pathwayId);
    return api.postForm<PdfPreviewResult>("/api/admin/courses/preview-pdf", form);
  },

  importPdf: (file: File, schoolId: string, createCourse = true, pathwayId?: string) => {
    const form = new FormData();
    form.append("school_id", schoolId);
    if (pathwayId) form.append("pathway_id", pathwayId);
    form.append("file", file);
    form.append("create_course", String(createCourse));
    return api.postForm<PdfImportResult>("/api/admin/courses/import-pdf", form);
  },

  // --- Médias (images de section) --------------------------------------
  /** Le serveur exige exactement une cible (`course_id` ou `school_id`) : l'éditeur de leçon fournit toujours le cours. */
  uploadSectionImage: (file: File, target: { courseId?: string; schoolId?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (target.courseId) form.append("course_id", target.courseId);
    else if (target.schoolId) form.append("school_id", target.schoolId);
    return api.postForm<MediaUploadResult>("/api/admin/media/images", form);
  },

  // --- Quiz -----------------------------------------------------------
  listQuizzes: (filters: { courseId?: string; lessonId?: string; skillId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.courseId) params.set("course_id", filters.courseId);
    if (filters.lessonId) params.set("lesson_id", filters.lessonId);
    if (filters.skillId) params.set("skill_id", filters.skillId);
    const qs = params.toString();
    return api.get<AdminQuizListResponse>(`/api/admin/quizzes${qs ? `?${qs}` : ""}`, true);
  },
  getQuiz: (id: string) => api.get<AdminQuiz>(`/api/admin/quizzes/${id}`, true),
  createQuiz: (data: AdminQuizInput) => api.post<AdminQuiz>("/api/admin/quizzes", data, true),
  updateQuiz: (id: string, data: AdminQuizInput) => api.put<AdminQuiz>(`/api/admin/quizzes/${id}`, data, true),
  deleteQuiz: (id: string) => api.delete(`/api/admin/quizzes/${id}`, true),

  // --- Progression globale (SUPER_ADMIN) -------------------------------
  listLearnerProgress: (params: { search?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    q.set("limit", String(params.limit ?? 20));
    q.set("offset", String(params.offset ?? 0));
    return api.get<Page<AdminLearnerProgressSummary>>(`/api/admin/progress/learners?${q.toString()}`, true);
  },
  getLearnerProgressDetail: (userId: string) =>
    api.get<AdminLearnerProgressDetail>(`/api/admin/progress/learners/${userId}`, true),

  // --- Certifications (SUPER_ADMIN) ------------------------------------
  listCertifications: () => api.get<AdminCertificationListResponse>("/api/admin/certifications", true),
  getCertification: (id: string) => api.get<AdminCertification>(`/api/admin/certifications/${id}`, true),
  updateCertificationRequirement: (
    certificationId: string,
    requirementId: string,
    data: AdminCertificationRequirementInput,
  ) =>
    api.put<AdminCertificationRequirement>(
      `/api/admin/certifications/${certificationId}/requirements/${requirementId}`,
      data,
      true,
    ),
};
