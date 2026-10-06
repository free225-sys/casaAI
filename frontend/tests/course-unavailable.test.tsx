import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseDetailPage } from "../src/pages/CourseDetailPage";
import { ApiError } from "../src/services/apiClient";
import { certificationService } from "../src/services/certificationService";
import { contentService } from "../src/services/contentService";

const auth = vi.hoisted(() => ({ user: null as null | { role: string } }));
vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ isAuthenticated: auth.user !== null, user: auth.user }) }));
vi.mock("../src/services/contentService", () => ({ contentService: { getCourse: vi.fn() } }));
vi.mock("../src/services/certificationService", () => ({ certificationService: { getCourseCertificateEligibility: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
const course = (id: string, title: string) => ({ id, school_id: "s", title, level: null, duration_min: null, color: null, description: null, final_quiz_id: null, resources: [], lessons: [] });
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const mount = async (path = "/courses/c1") => { await act(async () => root.render(<MemoryRouter key={path} initialEntries={[path]}><Routes><Route path="/courses/:courseId" element={<CourseDetailPage />} /></Routes></MemoryRouter>)); await flush(); };

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = null;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(certificationService.getCourseCertificateEligibility).mockResolvedValue(null as never);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("fiche de cours : retrait et panne sont deux états distincts", () => {
  it("404 : « cours indisponible » avec issues catalogue et accueil, sans retry ni mot de panne", async () => {
    vi.mocked(contentService.getCourse).mockRejectedValue(new ApiError(404, "Cours introuvable."));
    await mount();
    expect(host.textContent).toContain("Ce cours n’est plus disponible");
    expect(host.querySelector('a[href="/catalog"]')).not.toBeNull();
    expect(host.querySelector('a[href="/"]')).not.toBeNull();
    expect([...host.querySelectorAll("button")].some(b => /Réessayer/.test(b.textContent ?? ""))).toBe(false);
    expect(host.textContent).not.toContain("Impossible de charger");
  });
  it("un apprenant connecté retrouve son espace dans les issues", async () => {
    auth.user = { role: "LEARNER" };
    vi.mocked(contentService.getCourse).mockRejectedValue(new ApiError(404, "Cours introuvable."));
    await mount();
    expect(host.querySelector('a[href="/app/dashboard"]')).not.toBeNull();
  });
  it.each([["503", new ApiError(503, "indisponible")], ["réseau", new Error("Offline")]])("%s : panne réessayable, jamais présentée comme un retrait", async (_name, failure) => {
    vi.mocked(contentService.getCourse).mockRejectedValueOnce(failure).mockResolvedValue(course("c1", "Cours TEST") as never);
    await mount();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Impossible de charger ce cours pour le moment");
    expect(host.textContent).not.toContain("n’est plus disponible");
    const retry = [...host.querySelectorAll("button")].find(b => /Réessayer/.test(b.textContent ?? ""))!;
    await click(retry);
    await flush();
    expect(host.textContent).toContain("Cours TEST");
    expect(contentService.getCourse).toHaveBeenCalledTimes(2);
  });
  it("ne garde ni l'ancien cours ni l'ancienne erreur quand l'identifiant change", async () => {
    vi.mocked(contentService.getCourse).mockImplementation(async (id: string) => { if (id === "c1") throw new ApiError(404, "x"); return course(id, `Cours ${id}`) as never; });
    await mount("/courses/c1");
    expect(host.textContent).toContain("n’est plus disponible");
    await mount("/courses/c2");
    expect(host.textContent).toContain("Cours c2");
    expect(host.textContent).not.toContain("n’est plus disponible");
  });
});
