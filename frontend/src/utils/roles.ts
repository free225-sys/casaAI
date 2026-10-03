import type { UserRole } from "../types/api";

/** Lot 1 (rôles et périmètres) : l'espace pédagogique est réservé aux apprenants ; les administrateurs gèrent le catalogue.
 * Hypothèses notées dans CLAUDE_SYNC.md (MSG-018) en attendant confirmation : page d'accueil par rôle ci-dessous,
 * état explicite (jamais une redirection ni une déconnexion) sur les URL apprenant, catalogue public visible de tous. */
const HOME: Record<UserRole, string> = {
  LEARNER: "/app/dashboard",
  ADMIN: "/admin/courses",
  SUPER_ADMIN: "/admin/users",
};

export function homePathFor(role: UserRole): string {
  return HOME[role];
}

/** Routes pédagogiques personnelles. `/app/profile` reste commun (compte et sécurité). */
export function isLearnerOnlyPath(path: string): boolean {
  return path.startsWith("/app/") && !path.startsWith("/app/profile");
}

/** Destination après connexion : l'URL d'origine, sauf si elle est interdite au rôle (alors son accueil). */
export function postLoginPath(role: UserRole, from: string | undefined): string {
  if (!from || (role !== "LEARNER" && isLearnerOnlyPath(from))) return homePathFor(role);
  return from;
}
