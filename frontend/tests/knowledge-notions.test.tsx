import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonNotionsSection } from "../src/components/LessonNotionsSection";
import { AdminLessonEditPage } from "../src/pages/admin/AdminLessonEditPage";
import { adminService } from "../src/services/adminService";
import { ApiError } from "../src/services/apiClient";

vi.mock("../src/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../src/services/adminService", () => ({ adminService: {
  listKnowledgeNodes: vi.fn(), getLessonKnowledgeNodes: vi.fn(), replaceLessonKnowledgeNodes: vi.fn(),
  getLesson: vi.fn(), createLesson: vi.fn(), updateLesson: vi.fn(), listQuizzes: vi.fn(),
} }));

let host: HTMLDivElement;
let root: Root;
const rev = (n: string) => n.repeat(64).slice(0, 64);
const node = (id: string, status = "PUBLISHED") => ({ id, title: `Notion ${id}`, status });
const state = (node_ids: string[], revision = rev("a")) => ({ lesson_id: "l1", node_ids, revision });
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const button = (text: string) => { const el = [...host.querySelectorAll("button")].find(b => b.textContent === text); if (!el) throw new Error(`Missing button: ${text}`); return el as HTMLButtonElement; };
const box = (id: string) => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(i => i.closest("label")?.textContent?.includes(`Notion ${id}`))!;
const mountSection = async (lessonId: string | null = "l1", onDirty?: (dirty: boolean) => void) => { await act(async () => root.render(<LessonNotionsSection lessonId={lessonId ?? undefined} onDirtyChange={onDirty} />)); await flush(); await flush(); };
const alertText = () => [...host.querySelectorAll('[role="alert"], .notice')].map(el => el.textContent).join(" | ");

beforeEach(() => {
  vi.resetAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(adminService.listKnowledgeNodes).mockImplementation((async ({ limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}) => {
    const all = ["a", "b", "c", "d"].map(id => node(id));
    return { items: all.slice(offset, offset + limit), total: all.length, limit, offset };
  }) as never);
  vi.mocked(adminService.getLessonKnowledgeNodes).mockResolvedValue(state(["b"]));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("sélecteur de notions d'une leçon", () => {
  it("une nouvelle leçon n'appelle aucun service et demande d'enregistrer d'abord la leçon", async () => {
    await mountSection(null);
    expect(host.textContent).toContain("Enregistrez d’abord la leçon");
    expect(adminService.listKnowledgeNodes).not.toHaveBeenCalled();
    expect(adminService.getLessonKnowledgeNodes).not.toHaveBeenCalled();
  });
  it("lit toutes les pages du référentiel, coche les notions associées et n'enregistre qu'avec le bouton dédié", async () => {
    vi.mocked(adminService.listKnowledgeNodes).mockImplementation((async ({ limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}) => {
      const all = Array.from({ length: 230 }, (_, i) => node(`n${String(i).padStart(3, "0")}`));
      return { items: all.slice(offset, offset + limit), total: all.length, limit, offset };
    }) as never);
    vi.mocked(adminService.getLessonKnowledgeNodes).mockResolvedValue(state(["n225"]));
    await mountSection();
    expect(vi.mocked(adminService.listKnowledgeNodes).mock.calls.map(([params]) => params?.offset)).toEqual([0, 100, 200]);
    expect(host.textContent).toContain("1 notion(s) sélectionnée(s) sur 230");
    expect(box("n225")!.checked).toBe(true);
    expect(adminService.replaceLessonKnowledgeNodes).not.toHaveBeenCalled();
    expect(button("Enregistrer les notions").disabled).toBe(true);
  });
  it("envoie les identifiants triés et la révision recopiée, puis réutilise la révision renvoyée", async () => {
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockResolvedValueOnce(state(["a", "c"], rev("b"))).mockResolvedValueOnce(state(["a"], rev("c")));
    await mountSection();
    await click(box("c")!); await click(box("a")!); await click(box("b")!);
    await click(button("Enregistrer les notions"));
    expect(adminService.replaceLessonKnowledgeNodes).toHaveBeenLastCalledWith("l1", { node_ids: ["a", "c"], expected_revision: rev("a") });
    expect(host.textContent).toContain("Notions enregistrées.");
    await click(box("c")!);
    await click(button("Enregistrer les notions"));
    expect(adminService.replaceLessonKnowledgeNodes).toHaveBeenLastCalledWith("l1", { node_ids: ["a"], expected_revision: rev("b") });
  });
  it("retire toutes les associations par une liste vide explicite", async () => {
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockResolvedValue(state([], rev("b")));
    await mountSection();
    await click(box("b")!);
    await click(button("Enregistrer les notions"));
    expect(adminService.replaceLessonKnowledgeNodes).toHaveBeenCalledWith("l1", { node_ids: [], expected_revision: rev("a") });
  });
  it("conflit de révision : relit l'état, conserve la sélection, n'envoie rien de plus et exige une action consciente", async () => {
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockRejectedValueOnce(new ApiError(409, "Les notions de cette leçon ont changé. Rechargez puis réessayez."));
    await mountSection();
    await click(box("c")!);
    vi.mocked(adminService.getLessonKnowledgeNodes).mockResolvedValueOnce(state(["b", "d"], rev("z")));
    await click(button("Enregistrer les notions"));
    expect(adminService.replaceLessonKnowledgeNodes).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Les notions de cette leçon ont changé pendant votre édition");
    expect(host.textContent).toContain("Ajoutées par un autre éditeur : Notion d");
    expect(box("c")!.checked).toBe(true);
    expect(button("Enregistrer les notions").disabled).toBe(true);
    await flush();
    expect(adminService.replaceLessonKnowledgeNodes).toHaveBeenCalledTimes(1); // aucun renvoi automatique
    await click(button("Garder ma sélection sur l’état actuel"));
    expect(box("c")!.checked).toBe(true);
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockResolvedValueOnce(state(["b", "c"], rev("y")));
    await click(button("Enregistrer les notions"));
    expect(adminService.replaceLessonKnowledgeNodes).toHaveBeenLastCalledWith("l1", { node_ids: ["b", "c"], expected_revision: rev("z") });
  });
  it("conflit : « Reprendre l'état du serveur » remplace la sélection locale", async () => {
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockRejectedValueOnce(new ApiError(409, "Les notions de cette leçon ont changé. Rechargez puis réessayez."));
    await mountSection();
    await click(box("c")!);
    vi.mocked(adminService.getLessonKnowledgeNodes).mockResolvedValueOnce(state(["d"], rev("z")));
    await click(button("Enregistrer les notions"));
    await click(button("Reprendre l’état du serveur"));
    expect(box("c")!.checked).toBe(false);
    expect(box("d")!.checked).toBe(true);
  });
  it("409 sur un cours partagé (même révision) : le texte du serveur est affiché, sans fausse alerte de conflit", async () => {
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockRejectedValueOnce(new ApiError(409, "Cours partagé : tous les parcours ou l’école doivent être attribués."));
    await mountSection();
    await click(box("c")!);
    await click(button("Enregistrer les notions"));
    expect(host.textContent).toContain("Cours partagé : tous les parcours ou l’école doivent être attribués.");
    expect(host.textContent).not.toContain("ont changé pendant votre édition");
    expect(box("c")!.checked).toBe(true);
  });
  it("422 : refus expliqué, sélection conservée ; 403 : refus de rôle ; panne réseau : retry identique sans risque", async () => {
    await mountSection();
    await click(box("c")!);
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockRejectedValueOnce(new ApiError(422, "Notion introuvable."));
    await click(button("Enregistrer les notions"));
    expect(host.textContent).toContain("Notion introuvable.");
    expect(host.textContent).toContain("Rien n’a été modifié");
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockRejectedValueOnce(new ApiError(403, "Accès refusé : rôle insuffisant."));
    await click(button("Enregistrer les notions"));
    expect(host.textContent).toContain("n’est pas autorisée");
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockRejectedValueOnce(new Error("Offline"));
    await click(button("Enregistrer les notions"));
    expect(host.textContent).toContain("sans risque");
    expect(box("c")!.checked).toBe(true);
    vi.mocked(adminService.replaceLessonKnowledgeNodes).mockResolvedValueOnce(state(["b", "c"], rev("b")));
    await click(button("Enregistrer les notions"));
    const calls = vi.mocked(adminService.replaceLessonKnowledgeNodes).mock.calls;
    expect(calls.length).toBe(4);
    expect(calls[3][1]).toEqual(calls[2][1]); // même corps, même révision
  });
  it("chargement : pannes indépendantes avec retry, sans effacer la sélection", async () => {
    vi.mocked(adminService.listKnowledgeNodes).mockRejectedValueOnce(new Error("Offline"));
    await mountSection();
    expect(alertText()).toContain("Impossible de charger le référentiel");
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    await click(button("Réessayer : référentiel des notions"));
    await flush();
    expect(box("b")!.checked).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    vi.mocked(adminService.getLessonKnowledgeNodes).mockRejectedValueOnce(new Error("Offline"));
    await mountSection();
    expect(alertText()).toContain("Impossible de charger les notions de cette leçon");
    await click(button("Réessayer : notions de la leçon"));
    await flush();
    expect(box("b")!.checked).toBe(true);
  });
  it("signale une notion non publiée et conserve une association absente du référentiel", async () => {
    vi.mocked(adminService.listKnowledgeNodes).mockResolvedValue({ items: [node("a", "DRAFT"), node("b", "ARCHIVED")], total: 2, limit: 100, offset: 0 } as never);
    vi.mocked(adminService.getLessonKnowledgeNodes).mockResolvedValue(state(["a", "b", "fantome"]));
    await mountSection();
    expect(host.textContent).toContain("Non publiées parmi votre sélection");
    expect(host.textContent).toContain("(brouillon)");
    expect(host.textContent).toContain("(archivée)");
    expect(host.textContent).toContain("Notion absente du référentiel chargé");
    expect(host.textContent).toContain("fantome");
    expect(host.textContent).toContain("tant que la notion, la leçon et son cours ne sont pas tous publiés");
  });
  it("signale à l'éditeur parent que des notions ne sont pas encore enregistrées", async () => {
    const dirty = vi.fn();
    await mountSection("l1", dirty);
    await click(box("c")!);
    expect(dirty).toHaveBeenLastCalledWith(true);
    await click(box("c")!);
    expect(dirty).toHaveBeenLastCalledWith(false);
  });
});

describe("éditeur de leçon : création puis notions", () => {
  const lessonRoutes = () => (
    <Routes>
      <Route path="/admin/courses/:courseId/lessons/:lessonId" element={<AdminLessonEditPage />} />
      <Route path="/admin/courses/:courseId" element={<p>PAGE DU COURS</p>} />
    </Routes>
  );
  const mountEditor = async (path: string) => { await act(async () => root.render(<MemoryRouter initialEntries={[path]}>{lessonRoutes()}</MemoryRouter>)); await flush(); await flush(); await flush(); };
  const type = (selector: string, value: string) => act(async () => { const el = host.querySelector<HTMLInputElement>(selector)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });

  it("après création, reste sur l'éditeur de la leçon créée (identifiant renvoyé) et charge ses notions, sans second POST", async () => {
    vi.mocked(adminService.createLesson).mockResolvedValue({ id: "l-new", course_id: "c1", title: "Nouvelle", level: null, duration_min: null, summary: null, example: null, position: 1, status: "DRAFT", objectives: [], sections: [], depth_levels: [] } as never);
    vi.mocked(adminService.getLesson).mockResolvedValue({ id: "l-new", course_id: "c1", title: "Nouvelle", level: null, duration_min: null, summary: null, example: null, position: 1, status: "DRAFT", objectives: [], sections: [], depth_levels: [] } as never);
    vi.mocked(adminService.listQuizzes).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(adminService.getLessonKnowledgeNodes).mockResolvedValue({ lesson_id: "l-new", node_ids: [], revision: rev("a") });
    await mountEditor("/admin/courses/c1/lessons/new");
    expect(host.textContent).toContain("Enregistrez d’abord la leçon");
    await type("#title", "Nouvelle");
    await click(button("Enregistrer la leçon"));
    await flush(); await flush(); await flush();
    expect(adminService.createLesson).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("PAGE DU COURS");
    expect(host.textContent).toContain("Leçon créée.");
    expect(adminService.getLessonKnowledgeNodes).toHaveBeenCalledWith("l-new");
    expect(box("a")).toBeTruthy();
    // La panne de lecture ou d'enregistrement des notions ne remet pas en cause la création : aucun nouvel appel de création.
    expect(adminService.createLesson).toHaveBeenCalledTimes(1);
  });
  it("enregistrer le texte d'une leçon existante ne quitte pas la page tant que des notions ne sont pas enregistrées", async () => {
    vi.mocked(adminService.getLesson).mockResolvedValue({ id: "l1", course_id: "c1", title: "Leçon un", level: null, duration_min: null, summary: null, example: null, position: 1, status: "DRAFT", objectives: [], sections: [], depth_levels: [] } as never);
    vi.mocked(adminService.listQuizzes).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(adminService.updateLesson).mockResolvedValue({} as never);
    await mountEditor("/admin/courses/c1/lessons/l1");
    await click(box("c")!);
    await click(button("Enregistrer la leçon"));
    await flush();
    expect(adminService.updateLesson).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("PAGE DU COURS");
    expect(host.textContent).toContain("Les notions ne sont pas encore enregistrées");
    expect(box("c")!.checked).toBe(true);
  });
  it("sans modification de notions, l'enregistrement de la leçon retourne au cours comme avant", async () => {
    vi.mocked(adminService.getLesson).mockResolvedValue({ id: "l1", course_id: "c1", title: "Leçon un", level: null, duration_min: null, summary: null, example: null, position: 1, status: "DRAFT", objectives: [], sections: [], depth_levels: [] } as never);
    vi.mocked(adminService.listQuizzes).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(adminService.updateLesson).mockResolvedValue({} as never);
    await mountEditor("/admin/courses/c1/lessons/l1");
    await click(button("Enregistrer la leçon"));
    await flush();
    expect(host.textContent).toContain("PAGE DU COURS");
  });
});
