import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryModule } from "../src/components/discovery/DiscoveryModule";
import { SCENE_TEXTS } from "../src/components/discovery/discoveryContent";
import { discoveryService } from "../src/services/discoveryService";

vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
vi.mock("../src/services/discoveryService", () => ({ discoveryService: { getLinks: vi.fn() } }));
// Échec d'exécution du module de simulation : le repli texte, du bundle principal, doit prendre le relais.
vi.mock("../src/components/discovery/DiscoverySimulation", () => ({ default: () => { throw new Error("échec d'exécution simulé"); } }));

let host: HTMLDivElement;
let root: Root;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("IntersectionObserver", undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(discoveryService.getLinks).mockResolvedValue({ discovery_key: "llm-answer", registry_version: 1, scenes: [], notions: [], courses: [] });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("repli texte du module de découverte", () => {
  it("affiche le texte des six scènes quand le module de simulation échoue à l'exécution, sans promettre un site sans JavaScript", async () => {
    await act(async () => root.render(<MemoryRouter><DiscoveryModule /></MemoryRouter>));
    await flush(); await flush();
    expect(host.querySelector(".discovery-sim")).toBeNull();
    expect(host.textContent).toContain("La simulation n’a pas pu s’afficher");
    SCENE_TEXTS.forEach(scene => { expect(host.textContent).toContain(scene.title); expect(host.textContent).toContain(scene.text); });
    expect(host.textContent?.toLowerCase()).not.toContain("sans javascript");
  });
  it("garde le bloc des liens indépendant de la simulation : l'état des liens reste affiché", async () => {
    await act(async () => root.render(<MemoryRouter><DiscoveryModule /></MemoryRouter>));
    await flush(); await flush();
    // Réponse vide non conforme (aucune scène) : état d'incompatibilité visible, jamais un état vide.
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Liens momentanément incompatibles");
  });
});
