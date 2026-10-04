import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ postForm: vi.fn(), put: vi.fn(), get: vi.fn() }));
vi.mock("../src/services/apiClient", () => ({ api: { postForm: calls.postForm, put: calls.put, get: calls.get, post: vi.fn(), delete: vi.fn() } }));
import { adminService } from "../src/services/adminService";

const file = new File(["T"], "T.pdf", { type: "application/pdf" });
const form = (call: number) => calls.postForm.mock.calls[call][1] as FormData;
beforeEach(() => { vi.resetAllMocks(); });

describe("Formulaires envoyés au serveur (contrat OpenAPI du Lot 2)", () => {
  it("l'aperçu PDF n'envoie une cible que si elle est fournie", async () => {
    await adminService.previewPdf(file);
    expect([...form(0).keys()]).toEqual(["file"]);
    await adminService.previewPdf(file, { schoolId: "s1", pathwayId: "p1" });
    expect(form(1).get("school_id")).toBe("s1");
    expect(form(1).get("pathway_id")).toBe("p1");
    expect(calls.postForm.mock.calls[1][0]).toBe("/api/admin/courses/preview-pdf");
  });
  it("l'import envoie school_id, create_course et le parcours facultatif", async () => {
    await adminService.importPdf(file, "s1", true);
    expect(form(0).get("school_id")).toBe("s1");
    expect(form(0).get("create_course")).toBe("true");
    expect(form(0).has("pathway_id")).toBe(false);
    await adminService.importPdf(file, "s1", false, "p2");
    expect(form(1).get("create_course")).toBe("false");
    expect(form(1).get("pathway_id")).toBe("p2");
  });
  it("le média envoie exactement une cible : le cours, sinon l'école", async () => {
    await adminService.uploadSectionImage(file, { courseId: "c1", schoolId: "s1" });
    expect(form(0).get("course_id")).toBe("c1");
    expect(form(0).has("school_id")).toBe(false);
    await adminService.uploadSectionImage(file, { schoolId: "s1" });
    expect(form(1).get("school_id")).toBe("s1");
    expect(form(1).has("course_id")).toBe(false);
    expect(calls.postForm.mock.calls[0][0]).toBe("/api/admin/media/images");
  });
  it("les périmètres utilisent les routes et le corps du contrat", async () => {
    await adminService.getMyScopes();
    await adminService.getUserScopes("u1");
    await adminService.setUserScopes("u1", { school_ids: ["s1"], pathway_ids: [] });
    expect(calls.get.mock.calls.map(call => call[0])).toEqual(["/api/admin/me/scopes", "/api/admin/users/u1/scopes"]);
    expect(calls.put).toHaveBeenCalledWith("/api/admin/users/u1/scopes", { school_ids: ["s1"], pathway_ids: [] });
  });
});
