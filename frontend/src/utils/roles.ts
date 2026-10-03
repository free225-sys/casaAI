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

/** Routes d'administration réservées au SUPER_ADMIN (gardes serveur et `RequireRole` inchangés ; ici, seulement le choix du retour). */
const SUPER_ADMIN_ONLY = ["/admin/users", "/admin/progress", "/admin/certifications"];

/** Un retour n'est accepté que s'il s'agit d'un chemin interne (« /… », jamais « //hôte », « http://… » ni un schéma). */
function isInternalPath(path: string): boolean {
  return /^\/(?![\\/])[^\s]*$/.test(path) && !path.includes("://");
}

function isAllowedFor(role: UserRole, path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  if (role === "LEARNER") return pathname !== "/admin" && !pathname.startsWith("/admin/");
  if (isLearnerOnlyPath(pathname)) return false;
  if (role === "ADMIN") return !SUPER_ADMIN_ONLY.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return true;
}

/** Destination après connexion : l'URL d'origine si elle est interne et permise au rôle, sinon l'accueil du rôle. */
export function postLoginPath(role: UserRole, from: unknown): string {
  if (typeof from !== "string" || !isInternalPath(from) || !isAllowedFor(role, from)) return homePathFor(role);
  return from;
}
