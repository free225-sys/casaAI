import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../src/pages/LoginPage";
import { RegisterPage } from "../src/pages/RegisterPage";
import { ApiError } from "../src/services/apiClient";
import { authService } from "../src/services/authService";
import { contentService } from "../src/services/contentService";
import { AuthProvider } from "../src/stores/authStore";
import { readReturnCourseId, resolveReturnDestination } from "../src/utils/returnCourse";

vi.mock("../src/services/authService", () => ({ authService: { register: vi.fn(), login: vi.fn(), me: vi.fn(), refresh: vi.fn(), logout: vi.fn() } }));
vi.mock("../src/services/contentService", () => ({ contentService: { getCourse: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
const learner = { id: "u1", email: "test@example.test", first_name: "TEST", last_name: "Apprenant", role: "LEARNER" };
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const type = (selector: string, value: string) => act(async () => { const el = host.querySelector<HTMLInputElement>(selector)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
const Leave = () => { const navigate = useNavigate(); return <button type="button" onClick={() => navigate("/catalog")}>Quitter</button>; };
const Where = ({ name }: { name: string }) => { const location = useLocation(); return <p data-testid="where">{name} {JSON.stringify(location.state ?? null)}</p>; };
const where = () => host.querySelector('[data-testid="where"]')?.textContent ?? "";

const mount = async (path: string, state?: unknown) => {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<><Leave /><RegisterPage /></>} />
          <Route path="/catalog" element={<Where name="CATALOGUE" />} />
          <Route path="/login" element={<><Leave /><LoginPage /></>} />
          <Route path="/courses/:courseId" element={<Where name="FICHE" />} />
          <Route path="/app/dashboard" element={<Where name="DASHBOARD" />} />
          <Route path="/app/quizzes" element={<Where name="QUIZ" />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  ));
  await flush();
};
const fillAndSubmit = async () => {
  await type("#firstName", "TEST"); await type("#lastName", "Apprenant"); await type("#email", "test@example.test"); await type("#password", "motdepasse-test");
  await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  await flush(); await flush();
};
const withReturn = { return_course_id: "cours-test" };

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(authService.register).mockResolvedValue(learner as never);
  vi.mocked(authService.login).mockResolvedValue({ access_token: "a", refresh_token: "r", token_type: "bearer" } as never);
  vi.mocked(authService.me).mockResolvedValue(learner as never);
  vi.mocked(contentService.getCourse).mockResolvedValue({ id: "cours-test" } as never);
});
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); });

describe("destination de retour : filtrage et revalidation", () => {
  it("ne lit que l'identifiant de cours de l'état du routeur", () => {
    expect(readReturnCourseId({ return_course_id: "cours-test" })).toBe("cours-test");
    expect(readReturnCourseId({ return_course_id: 42 })).toBeNull();
    expect(readReturnCourseId({ from: "/courses/x" })).toBeNull();
    expect(readReturnCourseId(null)).toBeNull();
  });
  it("accepte un cours publié, encode le segment et revalide auprès de l'API", async () => {
    vi.mocked(contentService.getCourse).mockResolvedValue({ id: "cours.test-1" } as never);
    expect(await resolveReturnDestination("LEARNER", "cours.test-1")).toEqual({ path: "/courses/cours.test-1", notice: null });
    expect(contentService.getCourse).toHaveBeenCalledWith("cours.test-1");
  });
  it.each(["", "../admin/users", "http://evil.test", "//evil.test", "/app/dashboard", "a b", "a/b", "a?x=1", "a#x", "é", "x".repeat(101)])("refuse l'identifiant %j sans aucun appel à l'API", async id => {
    const outcome = await resolveReturnDestination("LEARNER", id);
    expect(outcome).toEqual({ path: "/app/dashboard", notice: "invalid" });
    expect(contentService.getCourse).not.toHaveBeenCalled();
  });
  it("cours retiré (404) : tableau de bord et message « indisponible » ; panne ou 5xx : « non vérifiable », jamais un retrait", async () => {
    vi.mocked(contentService.getCourse).mockRejectedValueOnce(new ApiError(404, "Cours introuvable."));
    expect(await resolveReturnDestination("LEARNER", "cours-test")).toEqual({ path: "/app/dashboard", notice: "unavailable" });
    vi.mocked(contentService.getCourse).mockRejectedValueOnce(new ApiError(503, "indisponible"));
    expect((await resolveReturnDestination("LEARNER", "cours-test")).notice).toBe("unverifiable");
    vi.mocked(contentService.getCourse).mockRejectedValueOnce(new Error("Offline"));
    expect((await resolveReturnDestination("LEARNER", "cours-test")).notice).toBe("unverifiable");
  });
  it("refuse une réponse dont l'identifiant ne correspond pas", async () => {
    vi.mocked(contentService.getCourse).mockResolvedValue({ id: "autre" } as never);
    expect((await resolveReturnDestination("LEARNER", "cours-test")).notice).toBe("invalid");
  });
  it("un administrateur retourne vers son espace d'administration, jamais vers une activité apprenante, quand le cours n'est pas vérifiable", async () => {
    vi.mocked(contentService.getCourse).mockRejectedValueOnce(new Error("Offline"));
    expect((await resolveReturnDestination("ADMIN", "cours-test")).path).toBe("/admin/courses");
  });
});

describe("inscription avec retour au cours", () => {
  it("après une création réussie : identité fraîche, cours revalidé puis fiche du cours", async () => {
    await mount("/register", withReturn);
    await fillAndSubmit();
    expect(authService.register).toHaveBeenCalledTimes(1);
    expect(contentService.getCourse).toHaveBeenCalledWith("cours-test");
    expect(where()).toContain("FICHE");
  });
  it("cours retiré : tableau de bord avec le message distinct ; l'inscription n'est pas relancée", async () => {
    vi.mocked(contentService.getCourse).mockRejectedValue(new ApiError(404, "Cours introuvable."));
    await mount("/register", withReturn);
    await fillAndSubmit();
    expect(where()).toContain("DASHBOARD");
    expect(where()).toContain('"returnNotice":"unavailable"');
    expect(authService.register).toHaveBeenCalledTimes(1);
  });
  it("vérification impossible : tableau de bord avec un message « non vérifiable »", async () => {
    vi.mocked(contentService.getCourse).mockRejectedValue(new Error("Offline"));
    await mount("/register", withReturn);
    await fillAndSubmit();
    expect(where()).toContain('"returnNotice":"unverifiable"');
  });
  it("identifiant non valide : tableau de bord, aucune lecture de cours", async () => {
    await mount("/register", { return_course_id: "../admin/users" });
    await fillAndSubmit();
    expect(where()).toContain('"returnNotice":"invalid"');
    expect(contentService.getCourse).not.toHaveBeenCalled();
  });
  it("sans cours choisi, comportement inchangé : tableau de bord, aucune lecture de cours", async () => {
    await mount("/register");
    await fillAndSubmit();
    expect(where()).toContain("DASHBOARD");
    expect(contentService.getCourse).not.toHaveBeenCalled();
  });
  it("e-mail déjà utilisé : message existant, aucune connexion tentée", async () => {
    vi.mocked(authService.register).mockRejectedValue(new ApiError(409, "dup"));
    await mount("/register", withReturn);
    await fillAndSubmit();
    expect(host.textContent).toContain("Cet email est déjà utilisé.");
    expect(authService.login).not.toHaveBeenCalled();
  });
  it("réponse de création perdue : « Création non confirmée », aucune affirmation de succès, aucune relance automatique", async () => {
    vi.mocked(authService.register).mockRejectedValue(new Error("Offline"));
    await mount("/register", withReturn);
    await fillAndSubmit();
    expect(host.textContent).toContain("Création non confirmée : essayez de vous connecter.");
    expect(host.textContent).not.toContain("Compte créé");
    expect(authService.login).not.toHaveBeenCalled();
    await flush(); await flush();
    expect(authService.register).toHaveBeenCalledTimes(1);
    expect(host.querySelector('a[href="/login"]')).not.toBeNull();
  });
  it("erreur 5xx à la création : même état « non confirmée »", async () => {
    vi.mocked(authService.register).mockRejectedValue(new ApiError(502, "passerelle"));
    await mount("/register");
    await fillAndSubmit();
    expect(host.textContent).toContain("Création non confirmée");
  });
  it("création confirmée mais connexion automatique en échec : « Compte créé : connectez-vous », création jamais rejouée, session partielle nettoyée, cours conservé", async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error("Offline"));
    await mount("/register", withReturn);
    await fillAndSubmit();
    expect(host.textContent).toContain("Compte créé : connectez-vous.");
    expect(host.querySelector("form")).toBeNull();
    expect(authService.register).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("casa_access_token")).toBeNull();
    expect(localStorage.getItem("casa_refresh_token")).toBeNull();
    // Connexion normale ensuite : le cours choisi est revalidé après la connexion.
    vi.mocked(authService.login).mockResolvedValue({ access_token: "a", refresh_token: "r", token_type: "bearer" } as never);
    await click(host.querySelector('a[href="/login"]')!);
    await flush();
    await type("#email", "test@example.test"); await type("#password", "motdepasse-test");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await flush(); await flush();
    expect(contentService.getCourse).toHaveBeenCalledWith("cours-test");
    expect(where()).toContain("FICHE");
    expect(authService.register).toHaveBeenCalledTimes(1);
  });
  it("connexion réussie mais lecture de l'identité en échec : session partielle nettoyée, même état", async () => {
    vi.mocked(authService.me).mockRejectedValue(new Error("Offline"));
    await mount("/register");
    await fillAndSubmit();
    expect(host.textContent).toContain("Compte créé : connectez-vous.");
    expect(localStorage.getItem("casa_access_token")).toBeNull();
    expect(where()).toBe("");
  });
});

describe("flux abandonné pendant la revalidation du cours", () => {
  const abandon = async (path: string, settle: "resolve" | "reject") => {
    let finish: () => void = () => {};
    vi.mocked(contentService.getCourse).mockImplementation(() => new Promise((resolve, reject) => { finish = () => (settle === "resolve" ? resolve({ id: "cours-test" } as never) : reject(new ApiError(404, "Cours introuvable."))); }));
    await mount(path, withReturn);
    if (path === "/register") await fillAndSubmit();
    else { await type("#email", "test@example.test"); await type("#password", "motdepasse-test"); await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); await flush(); await flush(); }
    expect(contentService.getCourse).toHaveBeenCalledTimes(1); // la vérification est en cours
    await click([...host.querySelectorAll("button")].find(b => b.textContent === "Quitter")!);
    await flush();
    expect(where()).toContain("CATALOGUE");
    await act(async () => finish());
    await flush(); await flush();
    return where();
  };
  it.each([["register", "resolve"], ["register", "reject"], ["login", "resolve"], ["login", "reject"]] as const)("%s, résolution %s tardive : la page quittée ne force plus sa destination", async (page, settle) => {
    const final = await abandon(page === "register" ? "/register" : "/login", settle);
    expect(final).toContain("CATALOGUE");
    expect(final).not.toContain("FICHE");
    expect(final).not.toContain("DASHBOARD");
    expect(authService.register).toHaveBeenCalledTimes(page === "register" ? 1 : 0); // jamais de recréation du compte
  });
  it("une résolution tardive reste sans effet quand la personne est restée : la destination vérifiée est suivie", async () => {
    let finish: () => void = () => {};
    vi.mocked(contentService.getCourse).mockImplementation(() => new Promise(resolve => { finish = () => resolve({ id: "cours-test" } as never); }));
    await mount("/register", withReturn);
    await fillAndSubmit();
    await act(async () => finish());
    await flush();
    expect(where()).toContain("FICHE");
  });
});

describe("connexion avec retour au cours", () => {
  it("une URL d'origine garde la priorité sur le cours choisi", async () => {
    await mount("/login", { from: "/app/quizzes", return_course_id: "cours-test" });
    await type("#email", "test@example.test"); await type("#password", "motdepasse-test");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await flush(); await flush();
    expect(where()).toContain("QUIZ");
    expect(contentService.getCourse).not.toHaveBeenCalled();
  });
  it("le lien « Créer un compte » conserve le cours choisi dans l'état du routeur", async () => {
    await mount("/login", withReturn);
    const link = host.querySelector<HTMLAnchorElement>('a[href="/register"]')!;
    await click(link);
    await flush();
    expect(host.textContent).toContain("Créer un compte");
    await type("#firstName", "TEST"); await type("#lastName", "Apprenant"); await type("#email", "test@example.test"); await type("#password", "motdepasse-test");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await flush(); await flush();
    expect(contentService.getCourse).toHaveBeenCalledWith("cours-test");
  });
});
