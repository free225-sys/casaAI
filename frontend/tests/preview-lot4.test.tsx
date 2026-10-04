import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPreviewLessonPage } from "../src/pages/admin/AdminPreviewLessonPage";
import { AdminPreviewQuizPage } from "../src/pages/admin/AdminPreviewQuizPage";
import { LabDetailPage } from "../src/pages/LabDetailPage";
import { ApiError } from "../src/services/apiClient";
import { adminService } from "../src/services/adminService";
import { contentService } from "../src/services/contentService";
import { progressService } from "../src/services/progressService";

vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ user: { id: "me", role: "LEARNER" }, isAuthenticated: true }) }));
vi.mock("../src/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../src/services/adminService", () => ({ adminService: { previewLesson: vi.fn(), previewLessonDocument: vi.fn(), previewQuiz: vi.fn() } }));
vi.mock("../src/services/progressService", () => ({ progressService: { submitLab: vi.fn(), startLesson: vi.fn(), getLesson: vi.fn(), saveProgress: vi.fn(), completeLesson: vi.fn(), getMyProgress: vi.fn(), getMyBadges: vi.fn(), getMySkills: vi.fn() } }));
vi.mock("../src/services/contentService", () => ({ contentService: { getLab: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
const lesson = { id: "l1", course_id: "c1", skill_id: null, demo_id: null, title: "Leçon brouillon", level: "N2", duration_min: 20, summary: "Résumé de la leçon", example: "Exemple concret", position: 1, status: "DRAFT", objectives: ["Comprendre A"], sections: [{ title: "Section un", body: "Premier paragraphe.\n\nSecond paragraphe.", image_url: "/media/a.png", image_alt: "Schéma" }], depth_levels: [{ depth_key: "TECHNICAL", label: "Technique", title: "Détail", body: "Contenu technique" }] };
const quiz = { id: "q1", title: "Quiz brouillon", kind: "VALIDATION", lesson_id: "l1", course_id: null, skill_id: null, pass_threshold: 70, status: "DRAFT", questions: [{ id: "k1", question_text: "Quelle option ?", explanation: "Parce que A.", difficulty: 1, options: [{ id: "o1", option_text: "Option A", is_correct: true }, { id: "o2", option_text: "Option B", is_correct: false }] }] };
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const button = (text: string) => { const el = [...host.querySelectorAll("button")].find(b => b.textContent === text); if (!el) throw new Error(`Missing button: ${text}`); return el as HTMLButtonElement; };
const mount = (element: React.ReactNode, path: string, pattern: string) => act(async () => root.render(<MemoryRouter key={path} initialEntries={[path]}><Routes><Route path={pattern} element={element} /></Routes></MemoryRouter>));
const lessonPage = () => mount(<AdminPreviewLessonPage />, "/admin/preview/lessons/l1", "/admin/preview/lessons/:lessonId");
const quizPage = () => mount(<AdminPreviewQuizPage />, "/admin/preview/quizzes/q1", "/admin/preview/quizzes/:quizId");

beforeEach(() => { vi.resetAllMocks(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("Lot 4 : aperçus d'administration", () => {
  it("montre une leçon brouillon en lecture seule et n'appelle aucun service pédagogique", async () => {
    vi.mocked(adminService.previewLesson).mockResolvedValue(lesson as never);
    vi.mocked(adminService.previewLessonDocument).mockRejectedValue(new ApiError(404, "pas de document"));
    await lessonPage();
    expect(adminService.previewLesson).toHaveBeenCalledWith("l1");
    expect(host.textContent).toContain("Aperçu administratif en lecture seule");
    expect(host.textContent).toContain("sans créer de progression, de badge ni de tentative");
    expect(host.textContent).toContain("Brouillon");
    for (const text of ["Leçon brouillon", "Comprendre A", "Section un", "Premier paragraphe.", "Second paragraphe.", "Technique", "Exemple concret"]) expect(host.textContent).toContain(text);
    expect(host.querySelector("img")?.getAttribute("alt")).toBe("Schéma");
    expect(host.querySelector("input, textarea, select")).toBeNull();
    expect([...host.querySelectorAll("button")].some(b => /terminée|Continuer|Enregistrer/i.test(b.textContent ?? ""))).toBe(false);
    for (const call of Object.values(progressService)) expect(call).not.toHaveBeenCalled();
    expect(host.querySelector('a[href="/admin/courses/c1/lessons/l1"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Document d’origine");
  });
  it("affiche le document d'origine quand il existe, et distingue son absence d'une panne avec retry", async () => {
    vi.mocked(adminService.previewLesson).mockResolvedValue(lesson as never);
    vi.mocked(adminService.previewLessonDocument).mockRejectedValueOnce(new Error("Offline"));
    await lessonPage();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("document d’origine n’a pas pu être chargé");
    vi.mocked(adminService.previewLessonDocument).mockResolvedValue({ source_file: "x.pdf", page_count: 1, sections: [{ title: "Racine", level: 1, confidence: 0.9, blocks: [], children: [] }] } as never);
    await click(button("Réessayer le document"));
    expect(host.textContent).toContain("Document d’origine importé");
  });
  it("traite 404, 403 et panne comme des états distincts, sans contenu ni formulaire", async () => {
    vi.mocked(adminService.previewLessonDocument).mockRejectedValue(new ApiError(404, "x"));
    vi.mocked(adminService.previewLesson).mockRejectedValueOnce(new ApiError(404, "hors scope"));
    await lessonPage();
    expect(host.textContent).toContain("introuvable ou hors de votre périmètre");
    vi.mocked(adminService.previewLesson).mockRejectedValueOnce(new ApiError(403, "rôle"));
    await mount(<AdminPreviewLessonPage />, "/admin/preview/lessons/l2", "/admin/preview/lessons/:lessonId");
    expect(host.textContent).toContain("réservé aux comptes d’administration");
    vi.mocked(adminService.previewLesson).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(adminService.previewLesson).mockResolvedValue(lesson as never);
    await mount(<AdminPreviewLessonPage />, "/admin/preview/lessons/l3", "/admin/preview/lessons/:lessonId");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Impossible de charger l’aperçu");
    await click(button("Réessayer l’aperçu"));
    expect(host.textContent).toContain("Leçon brouillon");
  });
  it("montre un quiz avec son corrigé en texte, sans réponse saisissable ni tentative", async () => {
    vi.mocked(adminService.previewQuiz).mockResolvedValue(quiz as never);
    await quizPage();
    expect(adminService.previewQuiz).toHaveBeenCalledWith("q1");
    expect(host.textContent).toContain("avec corrigé, en lecture seule");
    expect(host.textContent).toContain("Aucune tentative, aucun score et aucun badge ne sont enregistrés");
    expect([...host.querySelectorAll("li")].find(li => li.textContent?.includes("Option A"))?.textContent).toContain("Bonne réponse");
    expect([...host.querySelectorAll("li")].find(li => li.textContent?.includes("Option B"))?.textContent).not.toContain("Bonne réponse");
    expect(host.textContent).toContain("Explication : Parce que A.");
    expect(host.querySelector('input, textarea, select, button[type="submit"]')).toBeNull();
    for (const call of Object.values(progressService)) expect(call).not.toHaveBeenCalled();
  });
  it("distingue quiz introuvable et panne avec retry", async () => {
    vi.mocked(adminService.previewQuiz).mockRejectedValueOnce(new ApiError(404, "x"));
    await quizPage();
    expect(host.textContent).toContain("introuvable ou hors de votre périmètre");
    vi.mocked(adminService.previewQuiz).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(adminService.previewQuiz).mockResolvedValue(quiz as never);
    await mount(<AdminPreviewQuizPage />, "/admin/preview/quizzes/q2", "/admin/preview/quizzes/:quizId");
    await click(button("Réessayer l’aperçu"));
    expect(host.textContent).toContain("Quiz brouillon");
  });
});

describe("Lot 4 : un lab est un entraînement sans note déclarée", () => {
  it("n'envoie plus de score auto-déclaré et ne promet ni note ni certification", async () => {
    vi.mocked(contentService.getLab).mockResolvedValue({ id: "lab", title: "TEST lab", school_id: null, level: null, duration_min: null, color: null, description: null, environment: null, instructions: null, dataset_ref: null, deliverable: null, evaluation_note: null, modes: [], skills: [], interactive_steps: null } as never);
    vi.mocked(progressService.submitLab).mockResolvedValue({ id: "r", lab_id: "lab", mode: null, completed: true, score: null, feedback: null, submitted_at: "2026-10-04T10:00:00Z" } as never);
    await mount(<LabDetailPage />, "/labs/lab", "/labs/:labId");
    expect(host.querySelector('input[type="range"]')).toBeNull();
    expect(host.textContent).not.toContain("Auto-évaluation");
    await click(button("Soumettre"));
    expect(progressService.submitLab).toHaveBeenCalledWith("lab", { mode: undefined, submission: undefined });
    expect(Object.keys((vi.mocked(progressService.submitLab).mock.calls[0][1]) as object)).not.toContain("score");
    expect(host.textContent).toContain("Votre entraînement est enregistré");
    expect(host.textContent).toContain("ne donne ni note ni certification");
  });
});
