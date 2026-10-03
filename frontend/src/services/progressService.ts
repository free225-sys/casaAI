import { api } from "./apiClient";
import type {
  AchievementBadge,
  AppNotification,
  NotificationSettings,
  LabResult,
  LessonDetail,
  LessonDocument,
  Quiz,
  QuizAttemptHistoryItem,
  QuizAttemptResult,
  QuizListItem,
  UserLessonProgress,
  UserSkillProgress,
} from "../types/api";

export const progressService = {
  getLesson: (id: string) => api.get<LessonDetail>(`/api/lessons/${id}`, true),
  getLessonDocument: (id: string) => api.get<LessonDocument>(`/api/lessons/${id}/document`, true),
  startLesson: (id: string) =>
    api.post<{ lesson_id: string; status: string; progress_pct: number }>(`/api/lessons/${id}/start`, undefined, true),
  saveProgress: (id: string, progress_pct: number) =>
    api.patch<{ lesson_id: string; status: string; progress_pct: number }>(`/api/lessons/${id}/progress`, { progress_pct }),
  completeLesson: (id: string) =>
    api.post<{ lesson_id: string; status: string; progress_pct: number; next_lesson_id?: string | null }>(
      `/api/lessons/${id}/complete`,
      undefined,
      true
    ),
  getMyBadges: () => api.get<AchievementBadge[]>("/api/me/badges", true),
  acknowledgeBadges: () => api.post<{ ok: boolean }>("/api/me/badges/ack", undefined, true),
  getNotificationSettings: () => api.get<NotificationSettings>("/api/me/notification-settings", true),
  updateNotificationSettings: (notify_badges: boolean) =>
    api.patch<NotificationSettings>("/api/me/notification-settings", { notify_badges }),
  listNotifications: () => api.get<AppNotification[]>("/api/me/notifications", true),

  getMyProgress: () => api.get<UserLessonProgress[]>("/api/me/progress", true),
  getMySkills: () => api.get<UserSkillProgress[]>("/api/me/skills", true),

  listQuizzes: () => api.get<QuizListItem[]>("/api/quizzes", true),
  getQuiz: (id: string) => api.get<Quiz>(`/api/quizzes/${id}`, true),
  getQuizBySkill: (skillId: string) => api.get<Quiz>(`/api/skills/${skillId}/quiz`, true),
  attemptQuiz: (id: string, answers: { question_id: string; selected_option_id: string | null }[]) =>
    api.post<QuizAttemptResult>(`/api/quizzes/${id}/attempt`, { answers }, true),
  getMyQuizHistory: () => api.get<QuizAttemptHistoryItem[]>("/api/me/quiz-history", true),

  submitLab: (id: string, payload: { mode?: string; submission?: Record<string, unknown>; score?: number }) =>
    api.post<LabResult>(`/api/labs/${id}/submit`, payload, true),
  getMyLabResults: () => api.get<LabResult[]>("/api/me/lab-results", true),
};
