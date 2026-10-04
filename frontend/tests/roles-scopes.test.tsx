import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Nav } from "../src/components/Nav";
import { RequireLearner } from "../src/components/RequireLearner";
import { CourseDetailPage } from "../src/pages/CourseDetailPage";
import { LabDetailPage } from "../src/pages/LabDetailPage";
import { LoginPage } from "../src/pages/LoginPage";
import { ProfilePage } from "../src/pages/ProfilePage";
import { api, configureApiClient } from "../src/services/apiClient";
import { certificationService } from "../src/services/certificationService";
import { contentService } from "../src/services/contentService";
import { portfolioService } from "../src/services/portfolioService";
import { profileService } from "../src/services/profileService";
import { progressService } from "../src/services/progressService";
import { RequireRole } from "../src/components/RequireRole";
import { AUTH_ROUTES, KNOWN_ROUTES, homePathFor, isLearnerOnlyPath, postLoginPath } from "../src/utils/roles";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; role: string; first_name: string; last_name: string; email: string; created_at: string; last_login_at: null }, login: vi.fn() }));
vi.mock("../src/stores/authStore", () => ({
  useAuth: () => ({ user: auth.user, isAuthenticated: auth.user !== null, isLoading: false, login: auth.login, logout: vi.fn(), updateUser: vi.fn() }),
}));
vi.mock("../src/services/progressService", () => ({ progressService: {
  listNotifications: vi.fn(), getMySkills: vi.fn(), getMyQuizHistory: vi.fn(), getNotificationSettings: vi.fn(), updateNotificationSettings: vi.fn(), getMyProgress: vi.fn(),
} }));
vi.mock("../src/services/certificationService", () => ({ certificationService: { listMyCourseCertificates: vi.fn(), getCourseCertificateEligibility: vi.fn(), issueCourseCertificate: vi.fn() } }));
vi.mock("../src/services/portfolioService", () => ({ portfolioService: { listMine: vi.fn() } }));
vi.mock("../src/services/profileService", () => ({ profileService: { getMyOnboardingProfile: vi.fn(), updateMyOnboardingProfile: vi.fn() } }));
vi.mock("../src/services/contentService", () => ({ contentService: { listProfileTypes: vi.fn(), listGoals: vi.fn(), listSkills: vi.fn(), getCourse: vi.fn(), getLab: vi.fn() } }));
vi.mock("../src/services/authService", () => ({ authService: { updateMe: vi.fn(), changePassword: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
const account = (role: string) => ({ id: "u", role, first_name: "TEST", last_name: "User", email: "user@example.test", created_at: "2026-10-01T10:00:00Z", last_login_at: null });
const links = () => [...host.querySelectorAll("nav a")].map(a => `${a.textContent}→${a.getAttribute("href")}`);
const mount = (element: React.ReactNode, path = "/") => act(async () => root.render(<MemoryRouter key={path} initialEntries={[path]}>{element}</MemoryRouter>));

beforeEach(() => {
  vi.resetAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(progressService.listNotifications).mockResolvedValue([]);
  vi.mocked(progressService.getMySkills).mockResolvedValue([]);
  vi.mocked(progressService.getMyQuizHistory).mockResolvedValue([]);
  vi.mocked(progressService.getNotificationSettings).mockResolvedValue({ notify_badges: true });
  vi.mocked(certificationService.listMyCourseCertificates).mockResolvedValue([]);
  vi.mocked(portfolioService.listMine).mockResolvedValue([]);
  vi.mocked(profileService.getMyOnboardingProfile).mockResolvedValue({ profile_type_id: null, level: null, career_objectives: null, goal_ids: [], interest_skill_ids: [] } as never);
  vi.mocked(contentService.listProfileTypes).mockResolvedValue([]);
  vi.mocked(contentService.listGoals).mockResolvedValue([]);
  vi.mocked(contentService.listSkills).mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); auth.user = null; });

describe("Lot 1 : accueil et redirections par rôle", () => {
  it("donne à chaque rôle son accueil et ne renvoie jamais un administrateur vers l'espace apprenant", () => {
    expect(homePathFor("LEARNER")).toBe("/app/dashboard");
    expect(homePathFor("ADMIN")).toBe("/admin/courses");
    expect(homePathFor("SUPER_ADMIN")).toBe("/admin/users");
    expect(isLearnerOnlyPath("/app/lessons/a")).toBe(true);
    expect(isLearnerOnlyPath("/app/profile")).toBe(false);
    expect(postLoginPath("LEARNER", undefined)).toBe("/app/dashboard");
    expect(postLoginPath("LEARNER", "/app/lessons/a")).toBe("/app/lessons/a");
    expect(postLoginPath("ADMIN", "/app/lessons/a")).toBe("/admin/courses");
    expect(postLoginPath("SUPER_ADMIN", "/app/dashboard")).toBe("/admin/users");
    expect(postLoginPath("ADMIN", "/admin/courses/c1")).toBe("/admin/courses/c1");
    expect(postLoginPath("ADMIN", "/app/profile")).toBe("/app/profile");
  });
  it("n'accepte jamais une URL de retour externe, malformée ou interdite au rôle", () => {
    for (const from of ["https://example.test/x", "//example.test/x", "javascript:alert(1)", "/\\example.test", "app/dashboard", "", undefined, null, 42, "/ x"]) {
      expect(postLoginPath("LEARNER", from)).toBe("/app/dashboard");
      expect(postLoginPath("ADMIN", from)).toBe("/admin/courses");
      expect(postLoginPath("SUPER_ADMIN", from)).toBe("/admin/users");
    }
    expect(postLoginPath("ADMIN", "/admin/users")).toBe("/admin/courses");
    expect(postLoginPath("ADMIN", "/admin/progress/u1")).toBe("/admin/courses");
    expect(postLoginPath("SUPER_ADMIN", "/admin/users")).toBe("/admin/users");
    expect(postLoginPath("LEARNER", "/admin/courses")).toBe("/app/dashboard");
    expect(postLoginPath("LEARNER", "/courses/c1?x=1#a")).toBe("/courses/c1?x=1#a");
  });
  it("redirige après connexion vers l'accueil du rôle, même depuis une URL d'apprenant", async () => {
    auth.login.mockResolvedValue(account("SUPER_ADMIN") as never);
    await act(async () => root.render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/app/quizzes" } }]}>
        <Routes><Route path="/login" element={<LoginPage />} /><Route path="/admin/users" element={<p>ACCUEIL SUPER ADMIN</p>} /><Route path="/app/quizzes" element={<p>QUIZ</p>} /></Routes>
      </MemoryRouter>));
    const set = (id: string, value: string) => { const input = host.querySelector<HTMLInputElement>(`#${id}`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); };
    await act(async () => { set("email", "u@example.test"); set("password", "synthetic-password"); });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(host.textContent).toContain("ACCUEIL SUPER ADMIN");
  });
});

describe("Lot 1 : retour de connexion limité aux routes connues et permises (R5, R6)", () => {
  it("refuse les chemins inconnus, les faux préfixes de profil, la casse différente et les paramètres invalides", () => {
    for (const role of ["LEARNER", "ADMIN", "SUPER_ADMIN"] as const) {
      const home = homePathFor(role);
      for (const from of ["/inexistant", "/app/profile-inexistant", "/app/profile/x", "/APP/dashboard", "/Admin/courses", "/app/lessons/", "/app/lessons/a/b", "/courses/a b", "/courses/a%00b?x=<", "/catalog?q=a;b", "/catalog#a b", "/login", "/register", "/forgot-password", "/reset-password"]) {
        expect(postLoginPath(role, from), `${role} ${from}`).toBe(home);
      }
    }
  });
  it("accepte les routes connues avec paramètres valides, à la barre finale près, selon le rôle", () => {
    expect(postLoginPath("LEARNER", "/app/lessons/abc-123")).toBe("/app/lessons/abc-123");
    expect(postLoginPath("LEARNER", "/app/profile")).toBe("/app/profile");
    expect(postLoginPath("LEARNER", "/catalog/")).toBe("/catalog/");
    expect(postLoginPath("ADMIN", "/admin/quizzes/new?kind=VALIDATION&lesson_id=l1&back=%2Fadmin%2Fcourses")).toBe("/admin/quizzes/new?kind=VALIDATION&lesson_id=l1&back=%2Fadmin%2Fcourses");
    expect(postLoginPath("ADMIN", "/admin/courses/c1/lessons/new")).toBe("/admin/courses/c1/lessons/new");
    expect(postLoginPath("SUPER_ADMIN", "/admin/progress/u1")).toBe("/admin/progress/u1");
    expect(postLoginPath("ADMIN", "/admin/progress/u1")).toBe("/admin/courses");
    expect(postLoginPath("ADMIN", "/app/skills/s/practice")).toBe("/admin/courses");
    expect(postLoginPath("LEARNER", "/admin/import-pdf")).toBe("/app/dashboard");
  });
  it("la table des routes connues correspond exactement aux routes de App.tsx", () => {
    const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const declared = [...source.matchAll(/path="([^"]+)"/g)].map(match => match[1].replace(/:[A-Za-z]+/g, ":id")).sort();
    const known = [...KNOWN_ROUTES.map(([pattern]) => pattern), ...AUTH_ROUTES].sort();
    expect(declared).toEqual(known);
    expect(isLearnerOnlyPath("/app/profile")).toBe(false);
    expect(isLearnerOnlyPath("/app/profile-inexistant")).toBe(false);
  });
  it("conserve la destination administrative demandée avant connexion, puis revient si le rôle y a droit", async () => {
    const run = async (role: string, path: string) => {
      auth.user = null;
      auth.login.mockImplementation(async () => { auth.user = account(role) as never; return auth.user; });
      await act(async () => root.render(
        <MemoryRouter key={`${role}${path}`} initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/import-pdf" element={<RequireRole roles={["ADMIN", "SUPER_ADMIN"]}><p>ADMIN IMPORT PDF</p></RequireRole>} />
            <Route path="/admin/certifications" element={<RequireRole roles={["SUPER_ADMIN"]}><p>ADMIN CERTIFICATIONS</p></RequireRole>} />
            <Route path="/admin/courses" element={<p>ACCUEIL ADMIN</p>} />
            <Route path="/admin/users" element={<p>ACCUEIL SUPER ADMIN</p>} />
          </Routes>
        </MemoryRouter>));
      expect(host.querySelector("form")).not.toBeNull();
      const set = (id: string, value: string) => { const input = host.querySelector<HTMLInputElement>(`#${id}`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); };
      await act(async () => { set("email", "u@example.test"); set("password", "synthetic-password"); });
      await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    };
    // Destinations différentes de l'accueil du rôle : sans `state.from`, la connexion retomberait sur l'accueil.
    await run("SUPER_ADMIN", "/admin/certifications");
    expect(host.textContent).toContain("ADMIN CERTIFICATIONS");
    await run("ADMIN", "/admin/import-pdf");
    expect(host.textContent).toContain("ADMIN IMPORT PDF");
    // Destination interdite au rôle : accueil du rôle, pas la page interdite.
    await run("ADMIN", "/admin/certifications");
    expect(host.textContent).toContain("ACCUEIL ADMIN");
  });
});

describe("Lot 1 : menus par rôle", () => {
  it("n'affiche les liens pédagogiques qu'aux apprenants", async () => {
    auth.user = account("LEARNER");
    await mount(<Nav />);
    expect(links()).toEqual(expect.arrayContaining(["Mon espace→/app/dashboard", "Quiz→/app/quizzes", "Portfolio→/app/portfolio", "Certifications→/app/certifications"]));
    expect(links().some(l => l.includes("Administration"))).toBe(false);
  });
  it.each([["ADMIN", "/admin/courses"], ["SUPER_ADMIN", "/admin/users"]])("%s : catalogue et administration seulement", async (role, home) => {
    auth.user = account(role);
    await mount(<Nav />);
    expect(links()).toEqual(["Catalogue→/catalog", `Administration→${home}`]);
  });
  it("garde un visiteur sur le catalogue et la connexion", async () => {
    await mount(<Nav />);
    expect(links()).toEqual(["Catalogue→/catalog", "Connexion→/login"]);
  });
});

describe("Lot 1 : cloche de notifications par rôle", () => {
  const open = async () => { await act(async () => host.querySelector<HTMLButtonElement>('button[aria-controls="notifications-panel"]')!.click()); };
  beforeEach(() => { vi.mocked(progressService.listNotifications).mockResolvedValue([{ id: "n1", type: "info", title: "Notification générique", body: null, read: false, created_at: "2026-10-03T10:00:00Z" }] as never); });
  it("un apprenant lit ses notifications et peut ouvrir le réglage", async () => {
    auth.user = account("LEARNER");
    await mount(<Nav />);
    await open();
    expect(host.textContent).toContain("Notification générique");
    expect(host.querySelector('#notifications-panel a[href="/app/profile"]')?.textContent).toBe("Régler les notifications");
  });
  it.each(["ADMIN", "SUPER_ADMIN"])("%s lit les notifications génériques mais n'a pas de lien vers un réglage de badges", async role => {
    auth.user = account(role);
    await mount(<Nav />);
    await open();
    expect(progressService.listNotifications).toHaveBeenCalled();
    expect(host.textContent).toContain("Notification générique");
    expect(host.querySelector('#notifications-panel a[href="/app/profile"]')).toBeNull();
    expect(host.textContent).not.toContain("Régler les notifications");
    // Compte et sécurité restent accessibles par le menu du compte.
    expect(host.querySelector('button[aria-controls="account-panel"]')).not.toBeNull();
  });
  it("le profil d'un administrateur garde compte et sécurité mais pas la préférence de badges", async () => {
    auth.user = account("SUPER_ADMIN");
    await mount(<ProfilePage />);
    expect(host.textContent).toContain("Informations du compte");
    expect(host.textContent).toContain("Sécurité");
    expect(host.textContent).not.toContain("débloque un badge");
    expect(progressService.getNotificationSettings).not.toHaveBeenCalled();
  });
});

describe("Lot 1 : routes pédagogiques réservées aux apprenants", () => {
  const Guarded = () => <Routes><Route path="/app/dashboard" element={<RequireLearner><p>PAGE PEDAGOGIQUE</p></RequireLearner>} /><Route path="/login" element={<p>CONNEXION</p>} /></Routes>;
  it.each(["ADMIN", "SUPER_ADMIN"])("%s voit un état explicite avec un lien vers son espace, sans monter la page", async role => {
    auth.user = account(role);
    await mount(<Guarded />, "/app/dashboard");
    expect(host.textContent).not.toContain("PAGE PEDAGOGIQUE");
    expect(host.querySelector("h1")?.textContent).toBe("Espace réservé aux apprenants");
    expect(host.querySelector(`a[href="${homePathFor(role as "ADMIN")}"]`)).not.toBeNull();
  });
  it("laisse un apprenant ouvrir la page, et renvoie un visiteur vers la connexion", async () => {
    auth.user = account("LEARNER");
    await mount(<Guarded />, "/app/dashboard");
    expect(host.textContent).toContain("PAGE PEDAGOGIQUE");
    auth.user = null;
    await mount(<Guarded />, "/app/dashboard?visiteur");
    expect(host.textContent).toContain("CONNEXION");
  });
  it("traite un 403 comme un refus et non comme une session expirée", async () => {
    const expired = vi.fn(); const refresh = vi.fn(async () => true);
    configureApiClient({ getAccessToken: () => "synthetic", tryRefresh: refresh, onSessionExpired: expired });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Réservé aux apprenants" }), { status: 403, headers: { "content-type": "application/json" } })));
    await expect(api.get("/api/me/progress", true)).rejects.toMatchObject({ status: 403 });
    expect(expired).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("Lot 1 : aucun appel pédagogique pour un compte d'administration", () => {
  it("le profil d'un administrateur ne lit ni compétences, ni quiz, ni portfolio, ni certificats, ni onboarding", async () => {
    auth.user = account("ADMIN");
    await mount(<ProfilePage />);
    for (const call of [progressService.getMySkills, progressService.getMyQuizHistory, progressService.getNotificationSettings, certificationService.listMyCourseCertificates, portfolioService.listMine, profileService.getMyOnboardingProfile]) expect(call).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Informations du compte");
    expect(host.textContent).toContain("Sécurité");
    expect(host.textContent).not.toContain("Profil d'apprentissage");
    expect(host.textContent).not.toContain("Vue d'ensemble");
    expect(host.textContent).not.toContain("débloque un badge");
  });
  it("le profil d'un apprenant garde ses sections et ses lectures", async () => {
    auth.user = account("LEARNER");
    await mount(<ProfilePage />);
    expect(progressService.getMySkills).toHaveBeenCalled();
    expect(profileService.getMyOnboardingProfile).toHaveBeenCalled();
    expect(host.textContent).toContain("Profil d'apprentissage");
    expect(host.textContent).toContain("Vue d'ensemble");
  });
  it("la fiche d'un cours n'appelle pas l'éligibilité au certificat et n'offre ni leçon à ouvrir ni quiz à un administrateur", async () => {
    vi.mocked(contentService.getCourse).mockResolvedValue({ id: "c1", school_id: "s", title: "TEST cours", level: null, duration_min: null, color: null, description: null, final_quiz_id: "q", resources: [], lessons: [{ id: "l1", title: "Leçon un", level: null, duration_min: null, position: 1 }] } as never);
    auth.user = account("ADMIN");
    await mount(<Routes><Route path="/courses/:courseId" element={<CourseDetailPage />} /></Routes>, "/courses/c1");
    expect(host.textContent).toContain("Leçon un");
    expect(certificationService.getCourseCertificateEligibility).not.toHaveBeenCalled();
    expect(host.querySelector('a[href^="/app/"]')).toBeNull();
    auth.user = account("LEARNER");
    vi.mocked(certificationService.getCourseCertificateEligibility).mockResolvedValue({ quizzes: [], threshold: 80 } as never);
    await mount(<Routes><Route path="/courses/:courseId" element={<CourseDetailPage />} /></Routes>, "/courses/c1?apprenant");
    expect(certificationService.getCourseCertificateEligibility).toHaveBeenCalledWith("c1");
    expect(host.querySelector('a[href="/app/lessons/l1"]')).not.toBeNull();
    expect(host.querySelector('a[href="/app/quizzes/q"]')).not.toBeNull();
  });
  it("un lab est un entraînement : pas de soumission pour un administrateur", async () => {
    vi.mocked(contentService.getLab).mockResolvedValue({ id: "lab", title: "TEST lab", school_id: null, level: null, duration_min: null, color: null, description: null, environment: null, instructions: null, dataset_ref: null, deliverable: null, evaluation_note: null, modes: [], skills: [], interactive_steps: null } as never);
    auth.user = account("SUPER_ADMIN");
    await mount(<Routes><Route path="/labs/:labId" element={<LabDetailPage />} /></Routes>, "/labs/lab");
    expect(host.textContent).toContain("réservée aux apprenants");
    expect(host.querySelector("textarea")).toBeNull();
  });
});
