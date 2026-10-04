import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CertificationRequestSection } from "../src/components/CertificationRequestSection";
import { AdminCertificationRequestDetailPage } from "../src/pages/admin/AdminCertificationRequestDetailPage";
import { AdminCertificationRequestsPage } from "../src/pages/admin/AdminCertificationRequestsPage";
import { CertificationDetailPage } from "../src/pages/CertificationDetailPage";
import { CertificationRequestsPage } from "../src/pages/CertificationRequestsPage";
import { CourseDetailPage } from "../src/pages/CourseDetailPage";
import { ApiError } from "../src/services/apiClient";
import { certificationService } from "../src/services/certificationService";
import { contentService } from "../src/services/contentService";
import { portfolioService } from "../src/services/portfolioService";

vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ user: { id: "me", role: "LEARNER" }, isAuthenticated: true }) }));
vi.mock("../src/layouts/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../src/services/certificationService", () => ({ certificationService: {
  list: vi.fn(), get: vi.fn(), getMyEligibility: vi.fn(), getCourseCertificateEligibility: vi.fn(), listMyCourseCertificates: vi.fn(),
  submitRequest: vi.fn(), listMyRequests: vi.fn(), getMyRequest: vi.fn(), adminListRequests: vi.fn(), adminGetRequest: vi.fn(), decideRequest: vi.fn(),
} }));
vi.mock("../src/services/portfolioService", () => ({ portfolioService: { listMine: vi.fn() } }));
vi.mock("../src/services/contentService", () => ({ contentService: { getCourse: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
const request = (over: Record<string, unknown> = {}) => ({ id: "r1", user_id: "11111111-1111-1111-1111-111111111111", certification_id: "c1", statement: "Je remplis les critères.", evidence_ids: ["e1"], evidence_snapshot: [{ id: "e1", title: "Preuve un", context: "Contexte synthétique", result: "Résultat synthétique" }], status: "SUBMITTED", submitted_at: "2026-10-03T10:00:00Z", decided_by: null, decided_at: null, reason: null, official_certificate_id: null, ...over });
const page = (items: unknown[], total = items.length) => ({ items, total, limit: 20, offset: 0 });
const button = (text: string) => { const el = [...host.querySelectorAll("button")].find(b => b.textContent === text); if (!el) throw new Error(`Missing button: ${text}`); return el as HTMLButtonElement; };
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const type = (selector: string, value: string) => act(async () => { const el = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!; const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
const mount = (element: React.ReactNode, path = "/", pattern = "*") => act(async () => root.render(<MemoryRouter key={path} initialEntries={[path]}><Routes><Route path={pattern} element={element} /></Routes></MemoryRouter>));
const alertText = () => host.querySelector('[role="alert"]')?.textContent ?? "";

beforeEach(() => {
  vi.resetAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([]) as never);
  vi.mocked(certificationService.list).mockResolvedValue([{ id: "c1", title: "TEST certification", level: null, description: null, color: null }] as never);
  vi.mocked(certificationService.get).mockResolvedValue({ id: "c1", title: "TEST certification" } as never);
  vi.mocked(portfolioService.listMine).mockResolvedValue([{ id: "e1", title: "Preuve un" }, { id: "e2", title: "Preuve deux" }] as never);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("Lot 3 : demande de certification officielle (apprenant)", () => {
  it("envoie la déclaration et les preuves choisies, puis affiche la demande en attente de décision CASA", async () => {
    vi.mocked(certificationService.submitRequest).mockResolvedValue(request() as never);
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    expect(button("Envoyer ma demande à CASA").disabled).toBe(true);
    await type("#request-statement", "  Je remplis les critères.  ");
    await click(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    await click(button("Envoyer ma demande à CASA"));
    expect(certificationService.submitRequest).toHaveBeenCalledWith({ certification_id: "c1", evidence_ids: ["e1"], statement: "Je remplis les critères." });
    expect(host.textContent).toContain("En attente de décision CASA");
    expect(host.textContent).toContain("Preuve un");
    expect(host.querySelector("form")).toBeNull();
  });
  it("après un refus, le dossier refusé reste affiché et un dossier corrigé peut être déposé avec previous_request_id", async () => {
    vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([request({ status: "REJECTED", reason: "Preuves insuffisantes", decided_at: "2026-10-04T09:00:00Z" })]) as never);
    vi.mocked(certificationService.submitRequest).mockResolvedValue(request({ id: "r2", previous_request_id: "r1", statement: "Déclaration corrigée" }) as never);
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    expect(host.textContent).toContain("Refusée par CASA");
    expect(host.textContent).toContain("Preuves insuffisantes");
    expect(host.textContent).toContain("n’est pas rouvert");
    expect(host.querySelector("form")).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>("#request-statement")!.value).toBe("Je remplis les critères.");
    await type("#request-statement", "Déclaration corrigée");
    await click(button("Envoyer mon dossier corrigé à CASA"));
    expect(vi.mocked(certificationService.submitRequest)).toHaveBeenCalledWith({ certification_id: "c1", evidence_ids: ["e1"], statement: "Déclaration corrigée", previous_request_id: "r1" });
    expect(host.textContent).toContain("Dossiers précédents (1)");
    expect(host.querySelector("form")).toBeNull();
  });
  it("le dossier courant est celui sans successeur ; un premier dépôt n'envoie pas previous_request_id", async () => {
    vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([
      request({ id: "r2", previous_request_id: "r1", status: "SUBMITTED", submitted_at: "2026-10-05T10:00:00Z" }),
      request({ id: "r1", status: "REJECTED", reason: "Insuffisant", decided_at: "2026-10-04T09:00:00Z" }),
    ]) as never);
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    expect(host.textContent).toContain("En attente de décision CASA");
    expect(host.textContent).toContain("Dossiers précédents (1)");
    expect(host.querySelector("form")).toBeNull();
    vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([]) as never);
    vi.mocked(certificationService.submitRequest).mockResolvedValue(request() as never);
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />, "/premier");
    await type("#request-statement", "Première");
    await click(button("Envoyer ma demande à CASA"));
    expect(vi.mocked(certificationService.submitRequest).mock.calls[0][0]).toEqual({ certification_id: "c1", evidence_ids: [], statement: "Première" });
  });
  it("les métriques d'une preuve sont affichées de façon structurée et échappée", async () => {
    vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([request({ evidence_snapshot: [{ id: "e1", title: "Preuve un", context: "c", result: "r", metrics: { reviewed_measure: 7319, detail: { note: "<b>gras</b>" } } }] })]) as never);
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    expect(host.textContent).toContain("Métriques");
    expect(host.textContent).toContain("reviewed_measure");
    expect(host.textContent).toContain("7319");
    expect(host.textContent).toContain("<b>gras</b>");
    expect(host.querySelector("dd b")).toBeNull();
  });
  it("R11 : 409 puis rechargement en panne puis retry conserve la déclaration corrigée", async () => {
    const rejected = request({ status: "REJECTED", reason: "Insuffisant", decided_at: "2026-10-04T09:00:00Z" });
    vi.mocked(certificationService.listMyRequests).mockResolvedValueOnce(page([rejected]) as never).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(page([rejected]) as never);
    vi.mocked(certificationService.submitRequest).mockRejectedValueOnce(new ApiError(409, "identique"));
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    await type("#request-statement", "Déclaration corrigée");
    await click(button("Envoyer mon dossier corrigé à CASA"));
    expect(host.textContent).toContain("L’actualisation de vos demandes a échoué");
    expect(host.querySelector<HTMLTextAreaElement>("#request-statement")!.value).toBe("Déclaration corrigée");
    await click(button("Réessayer la demande"));
    expect(host.querySelector<HTMLTextAreaElement>("#request-statement")!.value).toBe("Déclaration corrigée");
    expect(host.textContent).not.toContain("L’actualisation de vos demandes a échoué");
  });
  it("une demande approuvée affiche l'identifiant du certificat officiel émis, sans lien de téléchargement inventé", async () => {
    vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([request({ status: "APPROVED", reason: "Conforme", official_certificate_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", decided_at: "2026-10-04T09:00:00Z" })]) as never);
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    expect(host.textContent).toContain("Approuvée par CASA");
    expect(host.textContent).toContain("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(host.querySelector('a[href*="pdf"], a[download]')).toBeNull();
  });
  it("explique les refus 409, 404, 422 et une panne sans perdre la saisie", async () => {
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    await type("#request-statement", "Ma déclaration");
    vi.mocked(certificationService.submitRequest).mockRejectedValueOnce(new ApiError(404, "preuve"));
    await click(button("Envoyer ma demande à CASA"));
    expect(host.textContent).toContain("est introuvable");
    vi.mocked(certificationService.submitRequest).mockRejectedValueOnce(new ApiError(422, "déclaration vide"));
    await click(button("Envoyer ma demande à CASA"));
    expect(host.textContent).toContain("déclaration vide");
    vi.mocked(certificationService.submitRequest).mockRejectedValueOnce(new Error("Offline"));
    await click(button("Envoyer ma demande à CASA"));
    expect(host.textContent).toContain("Votre saisie est conservée");
    expect(host.querySelector<HTMLTextAreaElement>("#request-statement")!.value).toBe("Ma déclaration");
    vi.mocked(certificationService.submitRequest).mockRejectedValueOnce(new ApiError(409, "payload différent"));
    await click(button("Envoyer ma demande à CASA"));
    expect(host.textContent).toContain("Dépôt refusé par le serveur");
  });
  it("propose un retry sur une panne de chargement, jamais un formulaire vide", async () => {
    vi.mocked(certificationService.listMyRequests).mockRejectedValueOnce(new Error("Offline"));
    await mount(<CertificationRequestSection certificationId="c1" certificationTitle="TEST certification" />);
    expect(alertText()).toContain("Impossible de charger");
    expect(host.querySelector("form")).toBeNull();
    await click(button("Réessayer la demande"));
    expect(host.querySelector("form")).not.toBeNull();
  });
  it("la fiche de certification présente l'éligibilité comme indicative", async () => {
    vi.mocked(certificationService.get).mockResolvedValue({ id: "c1", title: "TEST certification", level: null, description: "d", color: null, requirements: [] } as never);
    vi.mocked(certificationService.getMyEligibility).mockResolvedValue({ certification_id: "c1", eligible: true, requirements: [] } as never);
    await mount(<CertificationDetailPage />, "/app/certifications/c1", "/app/certifications/:certificationId");
    expect(host.textContent).toContain("Éligibilité indicative");
    expect(host.textContent).toContain("ne délivre aucune certification");
    expect(host.textContent).toContain("Demande de certification officielle");
  });
  it("l'historique liste les demandes avec le titre de la certification, vide sans panne", async () => {
    vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([request({ status: "APPROVED", reason: "Conforme" })]) as never);
    await mount(<CertificationRequestsPage />);
    expect(host.textContent).toContain("TEST certification");
    expect(host.textContent).toContain("Approuvée par CASA");
    vi.mocked(certificationService.listMyRequests).mockResolvedValue(page([]) as never);
    await mount(<CertificationRequestsPage />, "/vide");
    expect(host.textContent).toContain("Aucune demande");
  });
  it("la fiche d'un cours ne délivre plus de certificat : pas de bouton, aucun appel d'émission, certificat historique signalé", async () => {
    vi.mocked(contentService.getCourse).mockResolvedValue({ id: "c1", school_id: "s", title: "TEST cours", level: null, duration_min: null, color: null, description: null, final_quiz_id: null, resources: [], lessons: [] } as never);
    vi.mocked(certificationService.getCourseCertificateEligibility).mockResolvedValue({ course_id: "c1", threshold: 80, quizzes: [{ quiz_id: "q", quiz_title: "Quiz", kind: "VALIDATION", best_score: 90, attempted: true }], all_attempted: true, average_score: 90, eligible: true, already_issued: true, issued_at: "2026-09-01T10:00:00Z", official_decision_required: true } as never);
    await mount(<CourseDetailPage />, "/courses/c1", "/courses/:courseId");
    expect(host.textContent).not.toContain("Obtenir mon certificat");
    expect(host.textContent).toContain("ne délivre plus de certificat");
    expect(host.textContent).toContain("Certificat historique délivré");
    expect(host.querySelector('a[href="/app/certifications"]')).not.toBeNull();
  });
});

describe("Lot 3 : file d'examen et décision CASA (SUPER_ADMIN)", () => {
  it("liste par défaut les demandes à examiner, filtre par état côté serveur et distingue file vide et panne", async () => {
    vi.mocked(certificationService.adminListRequests).mockResolvedValue(page([request()], 41) as never);
    await mount(<AdminCertificationRequestsPage />);
    expect(certificationService.adminListRequests).toHaveBeenLastCalledWith({ state: "SUBMITTED", limit: 20, offset: 0 });
    expect(host.textContent).toContain("1 demande(s) affichée(s) sur 41");
    expect(host.querySelector('a[href="/admin/certification-requests/r1"]')?.textContent).toBe("Examiner");
    vi.mocked(certificationService.adminListRequests).mockResolvedValue(page([]) as never);
    await click(button("Refusées"));
    expect(certificationService.adminListRequests).toHaveBeenLastCalledWith({ state: "REJECTED", limit: 20, offset: 0 });
    expect(host.textContent).toContain("ce n’est pas une panne");
    await click(button("Toutes"));
    expect(certificationService.adminListRequests).toHaveBeenLastCalledWith({ state: undefined, limit: 20, offset: 0 });
    vi.mocked(certificationService.adminListRequests).mockRejectedValueOnce(new Error("Offline"));
    await click(button("Approuvées"));
    expect(alertText()).toContain("Impossible de charger les demandes");
    expect(host.textContent).not.toContain("ce n’est pas une panne");
    await click(button("Réessayer les demandes"));
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  const mountDetail = () => mount(<AdminCertificationRequestDetailPage />, "/admin/certification-requests/r1", "/admin/certification-requests/:requestId");
  it("exige une décision et un motif, confirme la conséquence, puis envoie la décision exacte", async () => {
    vi.mocked(certificationService.adminGetRequest).mockResolvedValue(request() as never);
    vi.mocked(certificationService.get).mockResolvedValue({ id: "c1", title: "TEST certification" } as never);
    vi.mocked(certificationService.decideRequest).mockResolvedValue(request({ status: "APPROVED", reason: "Conforme", official_certificate_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", decided_at: "2026-10-04T09:00:00Z" }) as never);
    await mountDetail();
    expect(host.textContent).toContain("Preuve un");
    expect(host.textContent).toContain("11111111-1111-1111-1111-111111111111");
    expect(button("Enregistrer la décision…").disabled).toBe(true);
    await click(host.querySelector<HTMLInputElement>('input[name="decision"]')!);
    expect(button("Enregistrer la décision…").disabled).toBe(true);
    await type("#decision-reason", "  Conforme  ");
    await click(button("Enregistrer la décision…"));
    expect(certificationService.decideRequest).not.toHaveBeenCalled();
    expect(host.querySelector("dialog")?.textContent).toContain("Cette décision est définitive");
    await click(button("Annuler"));
    expect(certificationService.decideRequest).not.toHaveBeenCalled();
    await click(button("Enregistrer la décision…"));
    await click([...host.querySelectorAll<HTMLButtonElement>("dialog button")].find(b => b.textContent === "Approuver et émettre")!);
    expect(certificationService.decideRequest).toHaveBeenCalledWith("r1", { decision: "APPROVED", reason: "Conforme" });
    expect(host.textContent).toContain("Décision enregistrée");
    expect(host.textContent).toContain("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(host.querySelector("form")).toBeNull();
  });
  it("un refus 409 est expliqué sans enregistrer de décision ni la rejouer", async () => {
    vi.mocked(certificationService.adminGetRequest).mockResolvedValue(request() as never);
    vi.mocked(certificationService.decideRequest).mockRejectedValue(new ApiError(409, "décision contradictoire"));
    await mountDetail();
    await click(host.querySelector<HTMLInputElement>('input[name="decision"]:not(:checked)')!);
    await type("#decision-reason", "Motif");
    await click(button("Enregistrer la décision…"));
    await click([...host.querySelectorAll<HTMLButtonElement>("dialog button")].find(b => b.textContent !== "Annuler")!);
    expect(certificationService.decideRequest).toHaveBeenCalledTimes(1);
    expect(alertText()).toContain("Décision refusée");
    expect(alertText()).toContain("décision contradictoire");
    expect(host.textContent).not.toContain("Décision enregistrée");
    expect(host.querySelector("dialog")).toBeNull();
  });
  it("une demande déjà décidée est en lecture seule et n'offre aucune nouvelle décision", async () => {
    vi.mocked(certificationService.adminGetRequest).mockResolvedValue(request({ status: "REJECTED", reason: "Insuffisant", decided_at: "2026-10-04T09:00:00Z" }) as never);
    await mountDetail();
    expect(host.textContent).toContain("Refusée par CASA");
    expect(host.querySelector("form")).toBeNull();
    expect(host.textContent).not.toContain("Enregistrer la décision");
  });
  it("une panne de chargement propose un retry et ne laisse aucun formulaire de décision", async () => {
    vi.mocked(certificationService.adminGetRequest).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(certificationService.adminGetRequest).mockResolvedValue(request() as never);
    await mountDetail();
    expect(alertText()).toContain("Aucune décision n’a été prise");
    expect(host.querySelector("form")).toBeNull();
    await click(button("Réessayer le chargement"));
    expect(host.querySelector("form")).not.toBeNull();
  });
});
