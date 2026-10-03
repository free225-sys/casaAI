import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogPage } from "../src/pages/CatalogPage";
import { LessonPage } from "../src/pages/LessonPage";
import { AdminUsersPage } from "../src/pages/admin/AdminUsersPage";
import { AdminCoursesPage } from "../src/pages/admin/AdminCoursesPage";
import { adminService } from "../src/services/adminService";
import { contentService } from "../src/services/contentService";
import { progressService } from "../src/services/progressService";

vi.mock("../src/services/contentService", () => ({ contentService: {
  listCourses: vi.fn(), listPathways: vi.fn(), listLabs: vi.fn(), getCourse: vi.fn(), listSchools: vi.fn(),
} }));
vi.mock("../src/services/adminService", () => ({ adminService: { listUsers: vi.fn(), listCourses: vi.fn() } }));
vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ user: { id: "current" } }) }));
vi.mock("../src/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../src/services/progressService", () => ({ progressService: {
  getLesson: vi.fn(), getLessonDocument: vi.fn(), startLesson: vi.fn(),
  saveProgress: vi.fn(), completeLesson: vi.fn(),
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
    vi.mocked(progressService.getLesson).mockRejectedValueOnce(new Error("Not found"));
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
