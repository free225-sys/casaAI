import type { UserRole } from "../types/api";

/** Lot 1 (rôles et périmètres) : l'espace pédagogique est réservé aux apprenants ; les administrateurs gèrent le catalogue.
 * Arbitrages du dev lead (MSG-019 ChatGPT) : accueil par rôle ci-dessous, état explicite (jamais une redirection ni une
 * déconnexion) sur les URL apprenant, catalogue public visible de tous, retour de connexion limité aux routes connues et permises. */
const HOME: Record<UserRole, string> = {
  LEARNER: "/app/dashboard",
  ADMIN: "/admin/courses",
  SUPER_ADMIN: "/admin/users",
};

export function homePathFor(role: UserRole): string {
  return HOME[role];
}

const ALL: readonly UserRole[] = ["LEARNER", "ADMIN", "SUPER_ADMIN"];
const LEARNER: readonly UserRole[] = ["LEARNER"];
const ADMINS: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"];
const SUPER: readonly UserRole[] = ["SUPER_ADMIN"];

/** Routes connues de `App.tsx` et rôles qui peuvent y revenir après connexion. Un test compare cette table aux `path=` de
 * `App.tsx` : toute route ajoutée ou retirée sans mise à jour ici fait échouer la suite. Ce choix du retour n'est pas un
 * contrôle d'accès : les gardes de route et surtout les gardes serveur restent la source de vérité. */
export const KNOWN_ROUTES: ReadonlyArray<readonly [pattern: string, roles: readonly UserRole[]]> = [
  ["/", ALL], ["/catalog", ALL], ["/pathways/:id", ALL], ["/courses/:id", ALL], ["/labs/:id", ALL],
  ["/app/profile", ALL],
  ["/app/dashboard", LEARNER], ["/app/lessons/:id", LEARNER], ["/app/skills/:id/practice", LEARNER], ["/app/quizzes", LEARNER],
  ["/app/quizzes/:id", LEARNER], ["/app/portfolio", LEARNER], ["/app/certifications", LEARNER], ["/app/certification-requests", LEARNER], ["/app/certifications/:id", LEARNER],
  ["/admin/courses", ADMINS], ["/admin/courses/:id", ADMINS], ["/admin/courses/:id/lessons/:id", ADMINS], ["/admin/quizzes/:id", ADMINS], ["/admin/import-pdf", ADMINS],
  ["/admin/users", SUPER], ["/admin/users/:id/scopes", SUPER], ["/admin/certification-requests", SUPER], ["/admin/certification-requests/:id", SUPER], ["/admin/progress", SUPER], ["/admin/progress/:id", SUPER], ["/admin/certifications", SUPER], ["/admin/certifications/:id", SUPER],
];

/** Routes d'authentification : jamais une destination de retour (revenir à la connexion après s'être connecté n'a pas de sens). */
export const AUTH_ROUTES: readonly string[] = ["/login", "/register", "/forgot-password", "/reset-password"];

const SEGMENT = "[A-Za-z0-9_.~%-]+";
const COMPILED = KNOWN_ROUTES.map(([pattern, roles]) => ({
  roles,
  regex: new RegExp(`^${pattern.split("/").map(part => (part.startsWith(":") ? SEGMENT : part)).join("/")}$`),
}));
const QUERY = /^\?[A-Za-z0-9_.~%=&+,-]*$/;
const HASH = /^#[A-Za-z0-9_-]*$/;

/** Routes pédagogiques personnelles (réservées aux apprenants). `/app/profile` est commun : comparaison exacte, pas de préfixe. */
export function isLearnerOnlyPath(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return COMPILED.some(route => route.roles === LEARNER && route.regex.test(pathname));
}

/** Destination après connexion : l'URL d'origine seulement si c'est une route connue, avec des paramètres valides, permise
 * au rôle ; sinon l'accueil du rôle. Comparaison sensible à la casse : « /APP/dashboard » n'est pas une route connue. */
export function postLoginPath(role: UserRole, from: unknown): string {
  if (typeof from !== "string") return homePathFor(role);
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(from);
  if (!match) return homePathFor(role);
  const [, rawPath, query = "", hash = ""] = match;
  const pathname = rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
  if (!QUERY.test(query || "?") || !HASH.test(hash || "#")) return homePathFor(role);
  const route = COMPILED.find(candidate => candidate.regex.test(pathname));
  if (!route || !route.roles.includes(role)) return homePathFor(role);
  return from;
}
