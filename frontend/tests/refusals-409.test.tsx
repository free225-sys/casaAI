import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCoursesPage } from "../src/pages/admin/AdminCoursesPage";
import { AdminLessonEditPage } from "../src/pages/admin/AdminLessonEditPage";
import { AdminQuizEditPage } from "../src/pages/admin/AdminQuizEditPage";
import { ApiError } from "../src/services/apiClient";
import { adminService } from "../src/services/adminService";
import { contentService } from "../src/services/contentService";
import { adminRefusal } from "../src/utils/adminErrors";

vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ user: { id: "me", role: "SUPER_ADMIN" } }) }));
vi.mock("../src/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../src/services/adminService", () => ({ adminService: {
  listCourses: vi.fn(), deleteCourse: vi.fn(), updateCourse: vi.fn(), getQuiz: vi.fn(), deleteQuiz: vi.fn(), updateQuiz: vi.fn(),
  getLesson: vi.fn(), listQuizzes: vi.fn(), updateLesson: vi.fn(),
} }));
vi.mock("../src/services/contentService", () => ({ contentService: { listSchools: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
const button = (text: string) => { const el = [...host.querySelectorAll("button")].find(b => b.textContent === text); if (!el) throw new Error(`Missing button: ${text}`); return el as HTMLButtonElement; };
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const mount = (element: React.ReactNode, path: string, pattern: string) => act(async () => root.render(<MemoryRouter key={path} initialEntries={[path]}><Routes><Route path={pattern} element={element} /></Routes></MemoryRouter>));
const alertText = () => host.querySelector('[role="alert"]')?.textContent ?? "";

beforeEach(() => {
  vi.resetAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(contentService.listSchools).mockResolvedValue([{ id: "s1", name: "École un" }] as never);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("Refus serveur (409, 404, 403) : affichés tels quels, sans contournement", () => {
  it("le message distingue suppression refusée, modification refusée, hors périmètre et rôle", () => {
    expect(adminRefusal(new ApiError(409, "quiz mixte"), "delete", "x")).toMatch(/Suppression refusée.*Dépubliez-le plutôt.*quiz mixte/s);
    expect(adminRefusal(new ApiError(409, "parents"), "save", "x")).toMatch(/Enregistrement refusé.*Rien n’a été modifié.*parents/s);
    expect(adminRefusal(new ApiError(404, "nope"), "save", "x")).toContain("hors de votre périmètre");
    expect(adminRefusal(new ApiError(403, "nope"), "delete", "x")).toContain("votre rôle ou votre périmètre");
    expect(adminRefusal(new Error("Offline"), "delete", "x")).toBe("Offline");
    expect(adminRefusal("inconnu", "delete", "La suppression a échoué.")).toBe("La suppression a échoué.");
  });
  it("une suppression de cours refusée en 409 est expliquée, n'est pas relancée et ne recharge pas la liste", async () => {
    vi.mocked(adminService.listCourses).mockResolvedValue({ items: [{ id: "c1", school_id: "s1", title: "TEST cours", level: null, duration_min: null, color: null, description: null, status: "DRAFT", created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z" }], total: 1, limit: 20, offset: 0 } as never);
    vi.mocked(adminService.deleteCourse).mockRejectedValue(new ApiError(409, "dépendance non modifiable"));
    await mount(<AdminCoursesPage />, "/admin/courses", "/admin/courses");
    await click(button("Supprimer"));
    await click(button("Supprimer définitivement"));
    expect(adminService.deleteCourse).toHaveBeenCalledTimes(1);
    expect(adminService.listCourses).toHaveBeenCalledTimes(1);
    expect(alertText()).toContain("Suppression refusée");
    expect(alertText()).toContain("Dépubliez-le plutôt");
    expect(alertText()).toContain("dépendance non modifiable");
    expect(host.querySelector("dialog")).toBeNull();
    expect(host.textContent).toContain("TEST cours");
  });
  it("une suppression de quiz refusée garde l'éditeur ouvert et ne propose aucune suppression en cascade", async () => {
    vi.mocked(adminService.getQuiz).mockResolvedValue({ id: "q1", title: "TEST quiz", kind: "PRACTICE", lesson_id: null, course_id: null, skill_id: "s", pass_threshold: 70, status: "DRAFT", questions: [] } as never);
    vi.mocked(adminService.deleteQuiz).mockRejectedValue(new ApiError(409, "tentatives historiques"));
    await mount(<AdminQuizEditPage />, "/admin/quizzes/q1", "/admin/quizzes/:quizId");
    await click(button("Supprimer le quiz"));
    const confirm = [...host.querySelectorAll<HTMLButtonElement>("dialog button")].find(b => b.textContent === "Supprimer le quiz")!;
    await click(confirm);
    expect(adminService.deleteQuiz).toHaveBeenCalledTimes(1);
    expect(alertText()).toContain("Suppression refusée");
    expect(alertText()).toContain("tentatives historiques");
    expect(host.querySelector("#title")).not.toBeNull();
    expect(button("Enregistrer le quiz").disabled).toBe(false);
  });
  it("une modification de leçon refusée en 409 est expliquée et ne perd pas la saisie", async () => {
    vi.mocked(adminService.getLesson).mockResolvedValue({ id: "l1", course_id: "c1", title: "Leçon un", level: null, duration_min: null, summary: null, example: null, position: 1, status: "DRAFT", objectives: [], sections: [], depth_levels: [] } as never);
    vi.mocked(adminService.listQuizzes).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(adminService.updateLesson).mockRejectedValue(new ApiError(409, "quiz dépendants"));
    await mount(<AdminLessonEditPage />, "/admin/courses/c1/lessons/l1", "/admin/courses/:courseId/lessons/:lessonId");
    await click(button("Enregistrer la leçon"));
    expect(adminService.updateLesson).toHaveBeenCalledTimes(1);
    expect(alertText()).toContain("Enregistrement refusé");
    expect(alertText()).toContain("quiz dépendants");
    expect(host.querySelector<HTMLInputElement>("#title")!.value).toBe("Leçon un");
  });
});
