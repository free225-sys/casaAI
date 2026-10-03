import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../src/pages/DashboardPage";
import { ApiError } from "../src/services/apiClient";
import { CatalogPage } from "../src/pages/CatalogPage";
import { LessonPage } from "../src/pages/LessonPage";
import { AdminUsersPage } from "../src/pages/admin/AdminUsersPage";
import { AdminImportPdfPage } from "../src/pages/admin/AdminImportPdfPage";
import { AdminLessonEditPage } from "../src/pages/admin/AdminLessonEditPage";
import { AdminCoursesPage } from "../src/pages/admin/AdminCoursesPage";
import { adminService } from "../src/services/adminService";
import { contentService } from "../src/services/contentService";
import { progressService } from "../src/services/progressService";

vi.mock("../src/services/contentService", () => ({ contentService: {
  listCourses: vi.fn(), listPathways: vi.fn(), listLabs: vi.fn(), getCourse: vi.fn(), listSchools: vi.fn(),
} }));
vi.mock("../src/services/adminService", () => ({ adminService: { listUsers: vi.fn(), listCourses: vi.fn(), getLesson: vi.fn(), listQuizzes: vi.fn(), previewPdf: vi.fn(), importPdf: vi.fn(), deleteCourse: vi.fn(), updateUser: vi.fn() } }));
vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ user: { id: "current" } }) }));
vi.mock("../src/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../src/services/progressService", () => ({ progressService: {
  getLesson: vi.fn(), getLessonDocument: vi.fn(), startLesson: vi.fn(),
  saveProgress: vi.fn(), completeLesson: vi.fn(), getMyProgress: vi.fn(), getMySkills: vi.fn(), getMyBadges: vi.fn(), acknowledgeBadges: vi.fn(),
} }));

let host: HTMLDivElement;
let root: Root;
let navigate: ReturnType<typeof useNavigate>;
function Harness() {
  navigate = useNavigate();
  return <Routes><Route path="/app/lessons/:lessonId" element={<LessonPage />} /></Routes>;
}
function lesson(id: string, has_document = false) {
  return { id, course_id: `course-${id}`, title: `Lesson ${id}`, position: 1,
    objectives: [], sections: [{ position: 1, title: `Section ${id}`, body: "Content" }],
    depth_levels: [], has_document };
}
async function mountLesson(id = "a") {
  await act(async () => root.render(<MemoryRouter initialEntries={[`/app/lessons/${id}`]}><Harness /></MemoryRouter>));
}
async function go(id: string) { await act(async () => { await navigate(`/app/lessons/${id}`); }); }
function button(text: string) {
  const result = [...host.querySelectorAll("button")].find(el => el.textContent === text);
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(progressService.startLesson).mockResolvedValue({ lesson_id: "a", status: "IN_PROGRESS", progress_pct: 0 });
  vi.mocked(progressService.getLesson).mockImplementation(async id => lesson(id) as never);
  vi.mocked(contentService.getCourse).mockImplementation(async id => ({ id, title: id, lessons: [] }) as never);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("Catalogue", () => {
  beforeEach(() => {
    for (const [method, id] of [["listCourses", "course"], ["listPathways", "pathway"], ["listLabs", "lab"]] as const) {
      vi.mocked(contentService[method]).mockResolvedValue({ items: [{ id, title: id, description: "Description", school_id: "school" }], total: 1 } as never);
    }
  });
  it("each chip shows only the matching section; Tout restores all three", async () => {
    await act(async () => root.render(<MemoryRouter><CatalogPage /></MemoryRouter>));
    for (const [label, expected] of [["Cours", 1], ["Parcours", 0], ["Labs", 2], ["Tout", -1]] as const) {
      await act(async () => button(label).click());
      [...host.querySelectorAll("section")].forEach((section, i) => {
        expect(section.style.display === "none").toBe(expected !== -1 && i !== expected);
      });
    }
  });
});

describe("Lesson navigation", () => {
  it("preserves main's next lesson link from the ordered course outline", async () => {
    vi.mocked(contentService.getCourse).mockResolvedValue({
      id: "course-a", title: "Course", lessons: [{ id: "b", position: 3 }, { id: "earlier", position: 1 }, { id: "a", position: 2 }],
    } as never);
    await mountLesson();
    expect(host.querySelector('a[href="/app/lessons/b"]')?.textContent).toContain("Leçon suivante");
    expect(button("Marquer comme terminée").disabled).toBe(false);
    expect(progressService.completeLesson).not.toHaveBeenCalled();
  });
  it("renders real section ids targeted by the table of contents", async () => {
    await mountLesson();
    expect(host.querySelector('a[href="#section-1"]')).not.toBeNull();
    expect(host.querySelector("section#section-1")?.textContent).toContain("Section a");
  });
  it("clears completion, next link and imported document on the next lesson", async () => {
    vi.mocked(progressService.getLesson).mockImplementation(async id => lesson(id, id === "a") as never);
    vi.mocked(progressService.getLessonDocument).mockResolvedValue({ source_file: "old.pdf", page_count: 1, sections: [] } as never);
    vi.mocked(progressService.completeLesson).mockResolvedValue({ lesson_id: "a", status: "COMPLETED", progress_pct: 100, next_lesson_id: "b" });
    await mountLesson();
    await act(async () => button("Marquer comme terminée").click());
    expect(host.textContent).toContain("old.pdf");
    expect(host.textContent).toContain("Leçon suivante");
    await go("b");
    expect(host.querySelector("h1")?.textContent).toBe("Lesson b");
    expect(button("Marquer comme terminée").disabled).toBe(false);
    expect(host.textContent).not.toContain("old.pdf");
    expect(host.textContent).not.toContain("Leçon suivante");
    expect(progressService.startLesson).toHaveBeenCalledWith("b");
  });
  it("recovers after a failed lesson load", async () => {
    vi.mocked(progressService.getLesson).mockRejectedValueOnce(new ApiError(404, "Not found"));
    await mountLesson();
    expect(host.textContent).toContain("introuvable");
    await go("b");
    expect(host.querySelector("h1")?.textContent).toBe("Lesson b");
  });
  it("ignores a previous lesson response that arrives after navigation", async () => {
    const old = deferred<ReturnType<typeof lesson>>();
    vi.mocked(progressService.getLesson).mockImplementation(id => id === "a" ? old.promise as never : Promise.resolve(lesson(id)) as never);
    await mountLesson(); await go("b");
    await act(async () => old.resolve(lesson("a")));
    expect(host.querySelector("h1")?.textContent).toBe("Lesson b");
  });
  it("ignores an old completion response after navigation", async () => {
    const old = deferred<{ lesson_id: string; status: string; progress_pct: number; next_lesson_id: string }>();
    vi.mocked(progressService.completeLesson).mockReturnValue(old.promise);
    await mountLesson(); await act(async () => button("Marquer comme terminée").click());
    await go("b");
    await act(async () => old.resolve({ lesson_id: "a", status: "COMPLETED", progress_pct: 100, next_lesson_id: "c" }));
    expect(button("Marquer comme terminée").disabled).toBe(false);
    expect(host.textContent).not.toContain("Leçon suivante");
  });
});

describe("Administration", () => {
  it("role filter sends the selected role and resets pagination", async () => {
    vi.mocked(adminService.listUsers).mockResolvedValue({ items: [], total: 45, limit: 20, offset: 0 });
    await act(async () => root.render(<AdminUsersPage />));
    await act(async () => button("Suivant").click());
    expect(adminService.listUsers).toHaveBeenLastCalledWith({ search: undefined, role: undefined, limit: 20, offset: 20 });
    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Filtrer par rôle"]')!;
    await act(async () => { select.value = "ADMIN"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(adminService.listUsers).toHaveBeenLastCalledWith({ search: undefined, role: "ADMIN", limit: 20, offset: 0 });
  });
  it("the creation form contains no copied search or status filter", async () => {
    vi.mocked(adminService.listCourses).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    vi.mocked(contentService.listSchools).mockResolvedValue([{ id: "school", name: "School" }] as never);
    await act(async () => root.render(<AdminCoursesPage />));
    await act(async () => button("Nouveau cours").click());
    const form = host.querySelector("form")!;
    expect(form.querySelectorAll("input")).toHaveLength(3);
    expect([...form.querySelectorAll("button")].map(el => el.textContent)).toEqual(["Créer le cours (brouillon)"]);
  });
});


describe("Lesson persistence and recovery", () => {
  it("restores an already completed lesson from start without completing again", async () => {
    vi.mocked(progressService.startLesson).mockResolvedValue({ lesson_id: "a", status: "COMPLETED", progress_pct: 100 });
    await mountLesson();
    expect(host.textContent).toContain("Progression enregistrée : 100 %");
    expect([...host.querySelectorAll("button")].find(el => el.textContent?.includes("Leçon terminée"))?.disabled).toBe(true);
    expect(progressService.completeLesson).not.toHaveBeenCalled();
  });
  it("restores partial progress without confusing reading position with persistence", async () => {
    vi.mocked(progressService.startLesson).mockResolvedValue({ lesson_id: "a", status: "IN_PROGRESS", progress_pct: 62 });
    await mountLesson();
    expect(host.textContent).toContain("Progression enregistrée : 62 %");
    expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-label")).toBe("Lecture de la page");
  });
  it("shows completion failure, allows retry, then confirms success", async () => {
    vi.mocked(progressService.completeLesson).mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ lesson_id: "a", status: "COMPLETED", progress_pct: 100 });
    await mountLesson();
    await act(async () => button("Marquer comme terminée").click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("n'a pas pu être marquée");
    expect(button("Marquer comme terminée").disabled).toBe(false);
    await act(async () => button("Marquer comme terminée").click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("Progression enregistrée : 100 %");
    expect(progressService.completeLesson).toHaveBeenCalledTimes(2);
  });
  it("ignores a late start response after completion", async () => {
    const start = deferred<{ lesson_id: string; status: string; progress_pct: number }>();
    vi.mocked(progressService.startLesson).mockReturnValue(start.promise);
    vi.mocked(progressService.completeLesson).mockResolvedValue({ lesson_id: "a", status: "COMPLETED", progress_pct: 100 });
    await mountLesson();
    await act(async () => button("Marquer comme terminée").click());
    await act(async () => start.resolve({ lesson_id: "a", status: "IN_PROGRESS", progress_pct: 5 }));
    expect(host.textContent).toContain("Progression enregistrée : 100 %");
    expect([...host.querySelectorAll("button")].find(el => el.textContent?.includes("Leçon terminée"))?.disabled).toBe(true);
  });
  it("offers a load retry for a network error rather than claiming 404", async () => {
    vi.mocked(progressService.getLesson).mockRejectedValueOnce(new Error("Offline"));
    await mountLesson();
    expect(host.textContent).not.toContain("introuvable");
    await act(async () => button("Réessayer le chargement").click());
    expect(host.querySelector("h1")?.textContent).toBe("Lesson a");
  });
  it("drops an old start response and completion failure after navigating", async () => {
    const start = deferred<{ lesson_id: string; status: string; progress_pct: number }>();
    const finish = deferred<{ lesson_id: string; status: string; progress_pct: number }>();
    vi.mocked(progressService.startLesson).mockReturnValueOnce(start.promise);
    vi.mocked(progressService.completeLesson).mockReturnValueOnce(finish.promise);
    await mountLesson();
    await act(async () => button("Marquer comme terminée").click());
    await go("b");
    await act(async () => { start.resolve({ lesson_id: "a", status: "COMPLETED", progress_pct: 100 }); finish.resolve({ lesson_id: "a", status: "COMPLETED", progress_pct: 100 }); });
    expect(host.textContent).toContain("Progression enregistrée : 0 %");
    expect(button("Marquer comme terminée").disabled).toBe(false);
  });
});

describe("Dashboard truthful states", () => {
  const row = (id: string, is_available = true) => ({ lesson_id: id, lesson_title: `History ${id}`, course_id: "course", status: "IN_PROGRESS", progress_pct: 40, started_at: null, completed_at: null, is_available });
  beforeEach(() => {
    vi.mocked(progressService.getMyProgress).mockResolvedValue([row("a")] as never);
    vi.mocked(progressService.getMySkills).mockResolvedValue([{ skill_id: "skill", skill_name: "Skill retained", mastery_level: 2 }] as never);
    vi.mocked(progressService.getMyBadges).mockResolvedValue([{ id: "first", title: "First badge", description: "Earned", earned: true, new: true }] as never);
    vi.mocked(progressService.acknowledgeBadges).mockResolvedValue({ ok: true });
  });
  const mount = () => act(async () => root.render(<MemoryRouter><DashboardPage /></MemoryRouter>));
  it("keeps successful sections when progress fails, and retries only that section", async () => {
    vi.mocked(progressService.getMyProgress).mockRejectedValueOnce(new Error("Offline"));
    await mount();
    expect(host.textContent).toContain("Skill retained");
    expect(host.textContent).toContain("First badge");
    expect(host.textContent).not.toContain("Vous n'avez pas encore commencé");
    expect(host.textContent).not.toContain("0 leçon terminée");
    await act(async () => button("Réessayer : la progression").click());
    expect(host.textContent).toContain("History a");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(progressService.getMySkills).toHaveBeenCalledTimes(1);
    expect(progressService.getMyBadges).toHaveBeenCalledTimes(1);
  });
  it("acknowledges badges only after explicit user action", async () => {
    await mount();
    expect(progressService.acknowledgeBadges).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Nouveau");
    await act(async () => button("Marquer les nouveaux badges comme lus").click());
    expect(progressService.acknowledgeBadges).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("Nouveau");
  });
  it("retains new badges when acknowledgement fails and allows retry", async () => {
    vi.mocked(progressService.acknowledgeBadges).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ ok: true });
    await mount();
    await act(async () => button("Marquer les nouveaux badges comme lus").click());
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).toContain("Nouveau");
    await act(async () => button("Marquer les nouveaux badges comme lus").click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).not.toContain("Nouveau");
  });
  it("keeps unavailable history but does not link or resume it", async () => {
    vi.mocked(progressService.getMyProgress).mockResolvedValue([row("old", false), row("current")] as never);
    await mount();
    expect(host.textContent).toContain("History old");
    expect(host.textContent).toContain("acquis conservés");
    expect(host.querySelector('a[href="/app/lessons/old"]')).toBeNull();
    expect(host.querySelector('a[href="/app/lessons/current"]')).not.toBeNull();
  });
  it("shows section-specific errors when every API read fails", async () => {
    vi.mocked(progressService.getMyProgress).mockRejectedValue(new Error("Offline"));
    vi.mocked(progressService.getMySkills).mockRejectedValue(new Error("Offline"));
    vi.mocked(progressService.getMyBadges).mockRejectedValue(new Error("Offline"));
    await mount();
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(3);
    expect(host.textContent).not.toContain("Aucun badge");
    expect(host.textContent).not.toContain("Réussissez un quiz");
  });
});


describe("Catalogue and administration recovery", () => {
  beforeEach(() => {
    vi.mocked(contentService.listPathways).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(contentService.listLabs).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(contentService.listSchools).mockResolvedValue([{ id: "school", name: "TEST school" }] as never);
    vi.mocked(adminService.listCourses).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  });
  it("loads subsequent catalogue pages and exposes every returned card", async () => {
    vi.mocked(contentService.listCourses).mockImplementation(async params => params?.offset
      ? { items: [{ id: "second", title: "Second course" }], total: 2 } as never
      : { items: [{ id: "first", title: "First course" }], total: 2 } as never);
    await act(async () => root.render(<MemoryRouter><CatalogPage /></MemoryRouter>));
    expect(host.querySelector('a[href="/courses/first"]')).not.toBeNull();
    expect(host.querySelector('a[href="/courses/second"]')).not.toBeNull();
    expect(contentService.listCourses).toHaveBeenLastCalledWith({ limit: 50, offset: 1 });
    expect(button("Tout").getAttribute("aria-pressed")).toBe("true");
  });
  it("distinguishes a catalogue failure from empty results and recovers", async () => {
    vi.mocked(contentService.listCourses).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ items: [], total: 0 } as never);
    await act(async () => root.render(<MemoryRouter><CatalogPage /></MemoryRouter>));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => button("Réessayer le catalogue").click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("Aucun résultat");
  });
  it("labels admin search as page-scoped and exposes the active status", async () => {
    await act(async () => root.render(<AdminCoursesPage />));
    expect(host.querySelector('input[aria-label="Rechercher un cours dans cette page"]')).not.toBeNull();
    await act(async () => button("Brouillons").click());
    expect(button("Brouillons").getAttribute("aria-pressed")).toBe("true");
    expect(button("Tous").getAttribute("aria-pressed")).toBe("false");
    expect(adminService.listCourses).toHaveBeenLastCalledWith({ status: "DRAFT", limit: 20, offset: 0 });
  });
  it("recovers a failed admin list without keeping a stale error", async () => {
    vi.mocked(adminService.listCourses).mockRejectedValueOnce(new Error("Offline"));
    await act(async () => root.render(<AdminCoursesPage />));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => button("Réessayer les cours").click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it("presents a failed lesson editor as a retryable error, never an editable empty lesson", async () => {
    vi.mocked(adminService.getLesson).mockRejectedValue(new Error("Offline"));
    vi.mocked(adminService.listQuizzes).mockResolvedValue({ items: [], total: 0 } as never);
    await act(async () => root.render(<MemoryRouter initialEntries={["/admin/courses/course/lessons/a"]}><Routes><Route path="/admin/courses/:courseId/lessons/:lessonId" element={<AdminLessonEditPage />} /></Routes></MemoryRouter>));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('input[id="title"]')).toBeNull();
    expect(button("Réessayer le chargement").disabled).toBe(false);
  });
});

describe("PDF decision context", () => {
  const preview = { title: "TEST PDF", pages: 2, sections: [], report: { anomalies: [{ message: "Titre à relire", page: 0 }], document_type: "TEXT", sections: 0, subsections: 0, blocks: 0, lists: 0, tables: 0, formulas: 0, code_blocks: 0, captions: 0 } };
  beforeEach(() => {
    vi.mocked(contentService.listSchools).mockResolvedValue([{ id: "school", name: "TEST school" }] as never);
    vi.mocked(adminService.previewPdf).mockResolvedValue(preview as never);
    vi.mocked(adminService.importPdf).mockResolvedValue({ title: "TEST PDF", course_id: "created", lesson_id: "created", pages_extracted: 2 } as never);
  });
  const mount = () => act(async () => root.render(<MemoryRouter><AdminImportPdfPage /></MemoryRouter>));
  async function choose() {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => { Object.defineProperty(input, "files", { configurable: true, value: [new File(["TEST"], "TEST.pdf", { type: "application/pdf" })] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
  }
  it("keeps file, school, mode and anomalies visible before import and clears selection coherently", async () => {
    await mount(); await choose();
    await act(async () => button("Analyser").click());
    const summary = host.querySelector('[aria-label="Résumé avant import"]');
    expect(summary?.textContent).toContain("TEST.pdf");
    expect(summary?.textContent).toContain("TEST school");
    expect(summary?.textContent).toContain("Créer un cours en brouillon");
    expect(host.querySelector("details")?.open).toBe(true);
    expect(host.textContent).toContain("Titre à relire");
    expect(adminService.importPdf).not.toHaveBeenCalled();
    await act(async () => button("Choisir un autre fichier").click());
    expect(host.querySelector('[aria-label="Résumé avant import"]')).toBeNull();
    expect(button("Analyser").disabled).toBe(true);
    await choose();
    expect(button("Analyser").disabled).toBe(false);
  });
  it("prevents changing the decision while import is pending and preserves a retry after failure", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(adminService.importPdf).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    await mount(); await choose();
    await act(async () => button("Analyser").click());
    await act(async () => button("Valider et importer").click());
    expect(host.querySelector<HTMLSelectElement>("select")?.disabled).toBe(true);
    expect(button("Choisir un autre fichier").disabled).toBe(true);
    await act(async () => reject(new Error("Network failed")));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Network failed");
    expect(button("Valider et importer").disabled).toBe(false);
    expect(host.querySelector('[aria-label="Résumé avant import"]')?.textContent).toContain("TEST.pdf");
  });
});

describe("Progress response races", () => {
  it("restores pending start when completion fails", async () => {
    const start = deferred<{ lesson_id: string; status: string; progress_pct: number }>();
    vi.mocked(progressService.startLesson).mockReturnValue(start.promise);
    vi.mocked(progressService.completeLesson).mockRejectedValue(new Error("Offline"));
    await mountLesson();
    await act(async () => button("Marquer comme terminée").click());
    await act(async () => start.resolve({ lesson_id: "a", status: "IN_PROGRESS", progress_pct: 62 }));
    expect(host.textContent).toContain("Progression enregistrée : 62 %");
    expect(host.textContent).not.toContain("en cours de synchronisation");
    expect(button("Marquer comme terminée").disabled).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("n'a pas pu être marquée");
  });
  it("cannot decrease confirmed progress when save responses arrive out of order", async () => {
    const first = deferred<{ lesson_id: string; status: string; progress_pct: number }>();
    const second = deferred<{ lesson_id: string; status: string; progress_pct: number }>();
    vi.mocked(progressService.saveProgress).mockResolvedValue({ lesson_id: "a", status: "IN_PROGRESS", progress_pct: 80 }).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldHeight = Object.getOwnPropertyDescriptor(document.documentElement, "scrollHeight");
    const oldY = Object.getOwnPropertyDescriptor(window, "scrollY");
    vi.useFakeTimers();
    try {
      Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: window.innerHeight + 1000 });
      Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
      await mountLesson();
      for (const pct of [30, 80]) {
        await act(async () => { Object.defineProperty(window, "scrollY", { configurable: true, value: pct * 10 }); window.dispatchEvent(new Event("scroll")); await vi.advanceTimersByTimeAsync(1500); });
      }
      expect(progressService.saveProgress).toHaveBeenNthCalledWith(1, "a", 30);
      expect(progressService.saveProgress).toHaveBeenNthCalledWith(2, "a", 80);
      await act(async () => second.resolve({ lesson_id: "a", status: "IN_PROGRESS", progress_pct: 80 }));
      await act(async () => first.resolve({ lesson_id: "a", status: "IN_PROGRESS", progress_pct: 30 }));
      expect(host.textContent).toContain("Progression enregistrée : 80 %");
      // Returning to the top changes the viewport indicator, not the acquired percentage.
      await act(async () => { Object.defineProperty(window, "scrollY", { configurable: true, value: 100 }); window.dispatchEvent(new Event("scroll")); await vi.advanceTimersByTimeAsync(1500); });
      expect(progressService.saveProgress).toHaveBeenLastCalledWith("a", 80);
    } finally {
      vi.useRealTimers();
      if (oldHeight) Object.defineProperty(document.documentElement, "scrollHeight", oldHeight); else Reflect.deleteProperty(document.documentElement, "scrollHeight");
      if (oldY) Object.defineProperty(window, "scrollY", oldY); else Reflect.deleteProperty(window, "scrollY");
    }
  });
});


describe("Confirmed completion dominates late errors", () => {
  it("does not contradict start confirming COMPLETED when complete later rejects", async () => {
    const start = deferred<{ lesson_id: string; status: string; progress_pct: number }>();
    let rejectComplete!: (reason: Error) => void;
    vi.mocked(progressService.startLesson).mockReturnValue(start.promise);
    vi.mocked(progressService.completeLesson).mockReturnValue(new Promise((_, reject) => { rejectComplete = reject; }));
    await mountLesson();
    await act(async () => button("Marquer comme terminée").click());
    await act(async () => start.resolve({ lesson_id: "a", status: "COMPLETED", progress_pct: 100 }));
    await act(async () => rejectComplete(new Error("Late network error")));
    expect(host.textContent).toContain("Progression enregistrée : 100 %");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).not.toContain("n'a pas pu être marquée");
    expect([...host.querySelectorAll("button")].find(el => el.textContent?.includes("Leçon terminée"))?.disabled).toBe(true);
  });
});


describe("Aurore administration safeguards", () => {
  const course = { id: "c1", school_id: "school", title: "TEST course", level: "N1", status: "DRAFT", duration_min: null, color: null, description: null, created_at: "", updated_at: "" };
  beforeEach(() => {
    vi.mocked(contentService.listSchools).mockResolvedValue([{ id: "school", name: "TEST school" }] as never);
  });
  it("lists courses in French with the school name and asks before deleting", async () => {
    vi.mocked(adminService.listCourses).mockResolvedValue({ items: [course], total: 1, limit: 20, offset: 0 } as never);
    vi.mocked(adminService.deleteCourse).mockResolvedValue(undefined as never);
    await act(async () => root.render(<MemoryRouter><AdminCoursesPage /></MemoryRouter>));
    expect(host.textContent).toContain("Brouillon");
    expect(host.textContent).not.toContain("DRAFT");
    expect(host.textContent).toContain("TEST school");
    expect(host.textContent).toContain("1 cours affiché(s) dans cette page.");
    await act(async () => button("Supprimer").click());
    expect(adminService.deleteCourse).not.toHaveBeenCalled();
    expect(host.querySelector("dialog")?.textContent).toContain("TEST course");
    await act(async () => button("Supprimer définitivement").click());
    expect(adminService.deleteCourse).toHaveBeenCalledWith("c1");
  });
  it("requires confirmation before changing a user's role", async () => {
    const user = { id: "u2", first_name: "TEST", last_name: "User", email: "test@example.test", role: "LEARNER", status: "ACTIVE" };
    vi.mocked(adminService.listUsers).mockResolvedValue({ items: [user], total: 1, limit: 20, offset: 0 } as never);
    vi.mocked(adminService.updateUser).mockResolvedValue(user as never);
    await act(async () => root.render(<AdminUsersPage />));
    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Rôle de TEST User"]')!;
    await act(async () => { select.value = "SUPER_ADMIN"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(adminService.updateUser).not.toHaveBeenCalled();
    await act(async () => button("Annuler").click());
    expect(adminService.updateUser).not.toHaveBeenCalled();
    await act(async () => { select.value = "ADMIN"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => button("Changer le rôle").click());
    expect(adminService.updateUser).toHaveBeenCalledWith("u2", { role: "ADMIN" });
  });
  it("links a successful PDF import to the created lesson editor and can start over", async () => {
    const preview = { title: "TEST PDF", pages: 2, sections: [], report: { anomalies: [], document_type: "TEXT", sections: 0, subsections: 0, blocks: 0, lists: 0, tables: 0, formulas: 0, code_blocks: 0, captions: 0 } };
    vi.mocked(adminService.previewPdf).mockResolvedValue(preview as never);
    vi.mocked(adminService.importPdf).mockResolvedValue({ title: "TEST PDF", course_id: "created", lesson_id: "lesson", pages_extracted: 2, warning: null } as never);
    await act(async () => root.render(<MemoryRouter><AdminImportPdfPage /></MemoryRouter>));
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => { Object.defineProperty(input, "files", { configurable: true, value: [new File(["TEST"], "TEST.pdf", { type: "application/pdf" })] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => button("Analyser").click());
    await act(async () => button("Valider et importer").click());
    expect(host.querySelector('a[href="/admin/courses/created/lessons/lesson"]')).not.toBeNull();
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Résultat");
    await act(async () => button("Importer un autre PDF").click());
    expect(button("Analyser").disabled).toBe(true);
  });
});
