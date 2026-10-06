import { ApiError } from "../services/apiClient";
import { contentService } from "../services/contentService";
import type { UserRole } from "../types/api";
import { homePathFor, postLoginPath } from "./roles";

/** Retour au cours choisi après inscription ou connexion. Seul un identifiant de cours est porté par l'état du routeur, jamais une URL : la
 * destination est reconstruite ici, soumise au filtre de rôle de `postLoginPath`, puis le cours est revalidé auprès de l'API. */
export type ReturnNotice = "unavailable" | "invalid" | "unverifiable" | "not-allowed";

export interface ReturnOutcome { path: string; notice: ReturnNotice | null }

const COURSE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export const RETURN_NOTICE_TEXT: Record<ReturnNotice, string> = {
  unavailable: "Le cours que vous aviez choisi n’est plus disponible. Voici votre espace ; vous pouvez en trouver d’autres dans le catalogue.",
  invalid: "Le cours demandé n’a pas pu être identifié. Voici votre espace.",
  unverifiable: "Nous n’avons pas pu vérifier ce cours (réseau ou service momentanément indisponible). Voici votre espace ; vous pourrez le retrouver depuis le catalogue.",
  "not-allowed": "Ce cours n’est pas accessible depuis votre espace.",
};

/** Lit `return_course_id` dans l'état du routeur ; tout ce qui n'est pas une chaîne est ignoré. */
export function readReturnCourseId(state: unknown): string | null {
  if (typeof state !== "object" || state === null) return null;
  const value = (state as { return_course_id?: unknown }).return_course_id;
  return typeof value === "string" ? value : null;
}

export async function resolveReturnDestination(role: UserRole, courseId: string): Promise<ReturnOutcome> {
  const home = homePathFor(role);
  if (!COURSE_ID.test(courseId)) return { path: home, notice: "invalid" };
  const path = `/courses/${encodeURIComponent(courseId)}`;
  if (postLoginPath(role, path) !== path) return { path: home, notice: "not-allowed" };
  try {
    const course = await contentService.getCourse(courseId);
    if (course?.id !== courseId) return { path: home, notice: "invalid" };
    return { path, notice: null };
  } catch (error) {
    return { path: home, notice: error instanceof ApiError && error.status === 404 ? "unavailable" : "unverifiable" };
  }
}
