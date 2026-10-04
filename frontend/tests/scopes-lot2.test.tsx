import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCoursesPage } from "../src/pages/admin/AdminCoursesPage";
import { AdminImportPdfPage } from "../src/pages/admin/AdminImportPdfPage";
import { AdminUserScopesPage } from "../src/pages/admin/AdminUserScopesPage";
import { AdminUsersPage } from "../src/pages/admin/AdminUsersPage";
import { ApiError } from "../src/services/apiClient";
import { adminService } from "../src/services/adminService";
import { contentService } from "../src/services/contentService";

const auth = vi.hoisted(() => ({ role: "SUPER_ADMIN" as string }));
vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ user: { id: "me", role: auth.role, first_name: "TEST", last_name: "Me", email: "me@example.test" } }) }));
vi.mock("../src/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../src/services/adminService", () => ({ adminService: {
  getMyScopes: vi.fn(), getUserScopes: vi.fn(), setUserScopes: vi.fn(), listUsers: vi.fn(), listCourses: vi.fn(), createCourse: vi.fn(),
  previewPdf: vi.fn(), importPdf: vi.fn(),
} }));
vi.mock("../src/services/contentService", () => ({ contentService: { listSchools: vi.fn(), listPathways: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
const schools = [{ id: "s1", name: "École un" }, { id: "s2", name: "École deux" }, { id: "s3", name: "École trois" }];
const pathwayRows = [1, 2, 3].map(n => ({ id: `p${n}`, title: `Parcours ${n}`, profile_label: null, level: null, duration_label: null, color: null, description: null }));
const grant = (school_id: string | null, pathway_id: string | null) => ({ school_id, pathway_id, assigned_by: "u0", assigned_at: "2026-10-02T10:00:00Z" });
const scopes = (school_ids: string[], pathway_ids: string[], global_access = false) => ({ school_ids, pathway_ids, grants: [...school_ids.map(id => grant(id, null)), ...pathway_ids.map(id => grant(null, id))], global_access });
const button = (text: string) => { const el = [...host.querySelectorAll("button")].find(b => b.textContent === text); if (!el) throw new Error(`Missing button: ${text}`); return el as HTMLButtonElement; };
const box = (label: string) => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(i => i.closest("label")?.textContent?.includes(label))!;
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const mount = (element: React.ReactNode, path = "/", key = path) => act(async () => root.render(<MemoryRouter key={key} initialEntries={[path]}>{element}</MemoryRouter>));
const mountScopes = (userId = "u1") => mount(<Routes><Route path="/admin/users/:userId/scopes" element={<AdminUserScopesPage />} /></Routes>, `/admin/users/${userId}/scopes`);

beforeEach(() => {
  vi.resetAllMocks();
  auth.role = "SUPER_ADMIN";
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(contentService.listSchools).mockResolvedValue(schools as never);
  vi.mocked(contentService.listPathways).mockImplementation((async ({ limit, offset }: { limit: number; offset: number }) => ({ items: pathwayRows.slice(offset, offset + limit), total: pathwayRows.length, limit, offset })) as never);
  vi.mocked(adminService.listCourses).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 } as never);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("Lot 2 : attribution du périmètre par le SUPER_ADMIN", () => {
  it("affiche le périmètre actuel, n'enregistre qu'après action et envoie le remplacement complet", async () => {
    vi.mocked(adminService.getUserScopes).mockResolvedValue(scopes(["s1"], ["p2"]) as never);
    vi.mocked(adminService.setUserScopes).mockImplementation((async (_id: string, body: { school_ids: string[]; pathway_ids: string[] }) => scopes(body.school_ids, body.pathway_ids)) as never);
    await mountScopes();
    expect(adminService.getUserScopes).toHaveBeenCalledWith("u1");
    expect(box("École un").checked).toBe(true);
    expect(box("École deux").checked).toBe(false);
    expect(box("Parcours 2").checked).toBe(true);
    expect(button("Enregistrer le périmètre").disabled).toBe(true);
    await click(box("École deux")); await click(box("Parcours 3")); await click(box("Parcours 2"));
    expect(host.textContent).toContain("Modifications non enregistrées");
    expect(adminService.setUserScopes).not.toHaveBeenCalled();
    await click(button("Enregistrer le périmètre"));
    expect(adminService.setUserScopes).toHaveBeenCalledWith("u1", { school_ids: ["s1", "s2"], pathway_ids: ["p3"] });
    expect(host.textContent).toContain("Périmètre enregistré : 2 école(s), 1 parcours.");
    expect(button("Enregistrer le périmètre").disabled).toBe(true);
  });
  it("affiche le refus du serveur sans perdre la sélection ni le périmètre précédent (409, 422, panne)", async () => {
    vi.mocked(adminService.getUserScopes).mockResolvedValue(scopes([], []) as never);
    await mountScopes();
    await click(box("École un"));
    vi.mocked(adminService.setUserScopes).mockRejectedValueOnce(new ApiError(409, "cible non ADMIN"));
    await click(button("Enregistrer le périmètre"));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("n’est pas un administrateur de contenu");
    expect(box("École un").checked).toBe(true);
    vi.mocked(adminService.setUserScopes).mockRejectedValueOnce(new ApiError(422, "école inexistante"));
    await click(button("Enregistrer le périmètre"));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("école inexistante");
    vi.mocked(adminService.setUserScopes).mockRejectedValueOnce(new Error("Offline"));
    await click(button("Enregistrer le périmètre"));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Le périmètre précédent est conservé");
    expect(button("Enregistrer le périmètre").disabled).toBe(false);
  });
  it("propose un retry sur une panne de chargement, jamais un formulaire vide modifiable", async () => {
    vi.mocked(adminService.getUserScopes).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(adminService.getUserScopes).mockResolvedValue(scopes(["s3"], []) as never);
    await mountScopes();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    await click(button("Réessayer le chargement"));
    expect(box("École trois").checked).toBe(true);
  });
  it("garde visibles les attributions inconnues et les parcours cochés malgré le filtre", async () => {
    vi.mocked(adminService.getUserScopes).mockResolvedValue(scopes(["s-disparue"], ["p1"]) as never);
    await mountScopes();
    expect(host.textContent).toContain("École inconnue (s-disparue)");
    const filter = host.querySelector<HTMLInputElement>("#pathway-filter")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(filter, "Parcours 3"); filter.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(box("Parcours 3")).toBeTruthy();
    expect(box("Parcours 1").checked).toBe(true);
    expect(host.textContent).not.toContain("Parcours 2");
  });
  it("charge tous les parcours jusqu'au total annoncé", async () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...pathwayRows[0], id: `m${i}`, title: `Parcours massif ${i}` }));
    vi.mocked(contentService.listPathways).mockImplementation((async ({ limit, offset }: { limit: number; offset: number }) => ({ items: many.slice(offset, offset + limit), total: many.length, limit, offset })) as never);
    vi.mocked(adminService.getUserScopes).mockResolvedValue(scopes([], []) as never);
    await mountScopes();
    expect(host.querySelectorAll('fieldset input[type="checkbox"]').length).toBe(3 + 45);
  });
  it("la liste des utilisateurs ne propose le périmètre qu'aux administrateurs de contenu", async () => {
    const user = (id: string, role: string) => ({ id, first_name: role, last_name: "TEST", email: `${id}@example.test`, role, status: "ACTIVE", created_at: "2026-10-01T10:00:00Z", last_login_at: null });
    vi.mocked(adminService.listUsers).mockResolvedValue({ items: [user("a", "ADMIN"), user("b", "LEARNER"), user("c", "SUPER_ADMIN")], total: 3, limit: 20, offset: 0 } as never);
    await mount(<AdminUsersPage />);
    const links = [...host.querySelectorAll("a")].filter(a => a.textContent === "Périmètre");
    expect(links.map(a => a.getAttribute("href"))).toEqual(["/admin/users/a/scopes"]);
  });
});

describe("Lot 2 : catalogue d'administration borné par le périmètre", () => {
  it("un ADMIN voit son périmètre et crée dans une école attribuée ou en fournissant un parcours attribué", async () => {
    auth.role = "ADMIN";
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes(["s2"], ["p1", "p3"]) as never);
    vi.mocked(adminService.createCourse).mockResolvedValue({} as never);
    await mount(<AdminCoursesPage />);
    expect(host.textContent).toContain("Votre périmètre : 1 école(s) et 2 parcours");
    await click(button("Nouveau cours"));
    expect([...host.querySelectorAll<HTMLOptionElement>("#school option")].map(o => o.textContent)).toEqual(["École un", "École deux (attribuée)", "École trois"]);
    expect([...host.querySelectorAll<HTMLOptionElement>("#pathway option")].map(o => o.textContent)).toEqual(["Aucun parcours", "Parcours 1", "Parcours 3"]);
    const set = (id: string, value: string) => { const el = host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!; const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); };
    // École attribuée par défaut : création possible sans parcours.
    expect(host.querySelector<HTMLSelectElement>("#school")!.value).toBe("s2");
    await act(async () => set("title", "TEST cours"));
    const submit = () => [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Créer le cours (brouillon)")!;
    expect(submit().disabled).toBe(false);
    // École non attribuée sans parcours : message et création bloquée ; avec un parcours attribué : autorisée et rattachée.
    await act(async () => set("school", "s1"));
    expect(host.textContent).toContain("Cette école ne vous est pas attribuée");
    expect(submit().disabled).toBe(true);
    await act(async () => set("pathway", "p3"));
    expect(submit().disabled).toBe(false);
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(adminService.createCourse).toHaveBeenCalledWith(expect.objectContaining({ school_id: "s1", pathway_id: "p3", title: "TEST cours", status: "DRAFT" }));
  });
  it("un périmètre vide est annoncé comme tel, distinct d'une panne, et bloque la création", async () => {
    auth.role = "ADMIN";
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes([], []) as never);
    await mount(<AdminCoursesPage />);
    expect(host.textContent).toContain("Aucun périmètre ne vous est attribué");
    expect(host.textContent).toContain("Aucun contenu dans votre périmètre");
    expect(host.textContent).toContain("ce n’est pas une panne");
    expect(button("Nouveau cours").disabled).toBe(true);
  });
  it("un ADMIN qui n'a qu'un parcours peut créer un cours en le rattachant à ce parcours", async () => {
    auth.role = "ADMIN";
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes([], ["p2"]) as never);
    await mount(<AdminCoursesPage />);
    expect(button("Nouveau cours").disabled).toBe(false);
  });
  it("une panne de lecture du périmètre est signalée avec retry sans masquer la liste serveur", async () => {
    auth.role = "ADMIN";
    vi.mocked(adminService.getMyScopes).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes(["s1"], []) as never);
    await mount(<AdminCoursesPage />);
    expect(host.textContent).toContain("Impossible de lire votre périmètre");
    expect(host.textContent).not.toContain("Aucun périmètre ne vous est attribué");
    expect(adminService.listCourses).toHaveBeenCalled();
    await click(button("Réessayer le périmètre"));
    expect(host.textContent).toContain("Votre périmètre : 1 école(s)");
  });
  it("un SUPER_ADMIN n'appelle jamais /me/scopes et garde toutes les écoles", async () => {
    await mount(<AdminCoursesPage />);
    expect(adminService.getMyScopes).not.toHaveBeenCalled();
    await click(button("Nouveau cours"));
    expect([...host.querySelectorAll("#school option")].length).toBe(3);
  });
});

describe("Lot 2 : import PDF avec cible autorisée", () => {
  const preview = { title: "TEST", pages: 2, sections: [], report: { anomalies: [], document_type: "TEXT", sections: 0, subsections: 0, blocks: 0, lists: 0, tables: 0, formulas: 0, code_blocks: 0, captions: 0 } };
  const pickFile = async () => { const input = host.querySelector<HTMLInputElement>('input[type="file"]')!; await act(async () => { Object.defineProperty(input, "files", { configurable: true, value: [new File(["T"], "T.pdf", { type: "application/pdf" })] }); input.dispatchEvent(new Event("change", { bubbles: true })); }); };
  beforeEach(() => {
    vi.mocked(adminService.previewPdf).mockResolvedValue(preview as never);
    vi.mocked(adminService.importPdf).mockResolvedValue({ title: "TEST", course_id: "c", lesson_id: "l", pages_extracted: 2, warning: null, document_id: "d", report: null } as never);
  });
  it("un ADMIN importe dans une école attribuée ou avec un parcours attribué, jamais en corpus sans cours", async () => {
    auth.role = "ADMIN";
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes(["s2"], ["p1"]) as never);
    await mount(<AdminImportPdfPage />);
    expect([...host.querySelectorAll<HTMLOptionElement>("#school option")].map(o => o.textContent)).toEqual(["École un", "École deux (attribuée)", "École trois"]);
    expect(host.querySelector<HTMLSelectElement>("#school")!.value).toBe("s2");
    expect([...host.querySelectorAll<HTMLOptionElement>("#pathway option")].map(o => o.textContent)).toEqual(["Aucun parcours", "Parcours 1"]);
    expect(host.querySelector<HTMLInputElement>('input[name="pdf-mode"]:not(:checked)')!.disabled).toBe(true);
    expect(host.textContent).toContain("Réservé aux super administrateurs");
    const pathway = host.querySelector<HTMLSelectElement>("#pathway")!;
    await act(async () => { pathway.value = "p1"; pathway.dispatchEvent(new Event("change", { bubbles: true })); });
    await pickFile();
    await click(button("Analyser"));
    expect(adminService.previewPdf).toHaveBeenCalledWith(expect.any(File), { schoolId: "s2", pathwayId: "p1" });
    await click(button("Valider et importer"));
    expect(adminService.importPdf).toHaveBeenCalledWith(expect.any(File), "s2", true, "p1");
  });
  it("une école non attribuée sans parcours bloque l'analyse avec une explication ; un parcours attribué la permet", async () => {
    auth.role = "ADMIN";
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes(["s2"], ["p1"]) as never);
    await mount(<AdminImportPdfPage />);
    await pickFile();
    const school = host.querySelector<HTMLSelectElement>("#school")!;
    await act(async () => { school.value = "s1"; school.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("Choisissez une école qui vous est attribuée, ou l’un de vos parcours");
    expect(button("Analyser").disabled).toBe(true);
    const pathway = host.querySelector<HTMLSelectElement>("#pathway")!;
    await act(async () => { pathway.value = "p1"; pathway.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(button("Analyser").disabled).toBe(false);
    await click(button("Analyser"));
    expect(adminService.previewPdf).toHaveBeenCalledWith(expect.any(File), { schoolId: "s1", pathwayId: "p1" });
  });
  it("un ADMIN sans aucun périmètre est bloqué avec une explication", async () => {
    auth.role = "ADMIN";
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes([], []) as never);
    await mount(<AdminImportPdfPage />);
    await pickFile();
    expect(host.textContent).toContain("Aucun périmètre ne vous est attribué");
    expect(button("Analyser").disabled).toBe(true);
    expect(adminService.previewPdf).not.toHaveBeenCalled();
  });
  it("un SUPER_ADMIN garde toutes les écoles, le corpus sans cours et n'envoie aucune cible à l'analyse", async () => {
    await mount(<AdminImportPdfPage />);
    expect(adminService.getMyScopes).not.toHaveBeenCalled();
    expect([...host.querySelectorAll("#school option")].length).toBe(3);
    expect(host.querySelector<HTMLInputElement>('input[name="pdf-mode"]:not(:checked)')!.disabled).toBe(false);
    await pickFile();
    await click(button("Analyser"));
    expect(adminService.previewPdf).toHaveBeenCalledWith(expect.any(File), undefined);
  });
});

describe("Lot 2 : réserves R7 et R8 de la revue", () => {
  const preview = { title: "TEST", pages: 2, sections: [], report: { anomalies: [], document_type: "TEXT", sections: 0, subsections: 0, blocks: 0, lists: 0, tables: 0, formulas: 0, code_blocks: 0, captions: 0 } };
  const pickFile = async () => { const input = host.querySelector<HTMLInputElement>('input[type="file"]')!; await act(async () => { Object.defineProperty(input, "files", { configurable: true, value: [new File(["T"], "T.pdf", { type: "application/pdf" })] }); input.dispatchEvent(new Event("change", { bubbles: true })); }); };
  const choose = (id: string, value: string) => act(async () => { const el = host.querySelector<HTMLSelectElement>(`#${id}`)!; el.value = value; el.dispatchEvent(new Event("change", { bubbles: true })); });
  beforeEach(() => {
    auth.role = "ADMIN";
    vi.mocked(adminService.previewPdf).mockResolvedValue(preview as never);
    vi.mocked(adminService.importPdf).mockResolvedValue({ title: "TEST", course_id: "c", lesson_id: "l", pages_extracted: 2, warning: null, document_id: "d", report: null } as never);
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes(["s2"], ["p1"]) as never);
  });
  it("R8 : changer la cible après l'aperçu l'invalide, retire la validation et exige une nouvelle analyse", async () => {
    await mount(<AdminImportPdfPage />);
    await pickFile();
    await choose("school", "s1"); await choose("pathway", "p1");
    await click(button("Analyser"));
    expect(button("Valider et importer")).toBeTruthy();
    expect(host.querySelector(".import-decision")?.textContent).toContain("Parcours");
    expect(host.querySelector(".import-decision")?.textContent).toContain("Parcours 1");
    await choose("pathway", "");
    expect([...host.querySelectorAll("button")].some(b => b.textContent === "Valider et importer")).toBe(false);
    expect(host.textContent).toContain("La cible de l’import a changé");
    expect(button("Analyser").disabled).toBe(true);
    expect(adminService.importPdf).not.toHaveBeenCalled();
    await choose("pathway", "p1");
    await click(button("Analyser"));
    expect(adminService.previewPdf).toHaveBeenCalledTimes(2);
    await click(button("Valider et importer"));
    expect(adminService.importPdf).toHaveBeenCalledTimes(1);
    expect(adminService.importPdf).toHaveBeenCalledWith(expect.any(File), "s1", true, "p1");
  });
  it("R8 : changer l'école de l'aperçu invalide aussi, même avec le même parcours", async () => {
    await mount(<AdminImportPdfPage />);
    await pickFile();
    await choose("school", "s1"); await choose("pathway", "p1");
    await click(button("Analyser"));
    await choose("school", "s3");
    expect([...host.querySelectorAll("button")].some(b => b.textContent === "Valider et importer")).toBe(false);
    expect(host.textContent).toContain("La cible de l’import a changé");
  });
  it("R7 : un parcours attribué non publié reste proposé sous une étiquette explicite et part dans l'aperçu", async () => {
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes([], ["p1", "p9"]) as never);
    await mount(<AdminImportPdfPage />);
    expect([...host.querySelectorAll<HTMLOptionElement>("#pathway option")].map(o => o.textContent)).toEqual(["Aucun parcours", "Parcours 1", "Parcours attribué non publié (p9)"]);
    await pickFile();
    await choose("pathway", "p9");
    await click(button("Analyser"));
    expect(adminService.previewPdf).toHaveBeenCalledWith(expect.any(File), { schoolId: "s1", pathwayId: "p9" });
  });
  it("R7 : une panne du référentiel des parcours est signalée avec retry, jamais une liste vide silencieuse", async () => {
    vi.mocked(adminService.getMyScopes).mockResolvedValue(scopes(["s2"], ["p1"]) as never);
    vi.mocked(contentService.listPathways).mockRejectedValueOnce(new Error("Offline"));
    await mount(<AdminImportPdfPage />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Impossible de charger vos parcours");
    expect(host.querySelector("#pathway")).toBeNull();
    await click(button("Réessayer les parcours"));
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect([...host.querySelectorAll<HTMLOptionElement>("#pathway option")].map(o => o.textContent)).toEqual(["Aucun parcours", "Parcours 1"]);
  });
  it("R7 : même signalement dans la création de cours", async () => {
    vi.mocked(contentService.listPathways).mockRejectedValueOnce(new Error("Offline"));
    await mount(<AdminCoursesPage />);
    expect(host.textContent).toContain("Impossible de charger vos parcours");
    await click(button("Réessayer les parcours"));
    expect(host.textContent).not.toContain("Impossible de charger vos parcours");
  });
});

