import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressRail } from "../src/components/ProgressRail";
import { HomePage } from "../src/pages/HomePage";

vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
vi.mock("../src/services/discoveryService", () => ({ discoveryService: { getLinks: vi.fn(async () => new Promise(() => {})) } }));

let host: HTMLDivElement;
let root: Root;
const media = (narrow: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-width: 760px") ? narrow : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));

beforeEach(() => { vi.stubGlobal("IntersectionObserver", undefined); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("accueil sur écran étroit", () => {
  it("le rail passe en liste sans positionnement absolu ni bascule 3D, et garde ses huit étapes lisibles par les lecteurs d'écran", async () => {
    media(true);
    await act(async () => root.render(<MemoryRouter><ProgressRail /></MemoryRouter>));
    const items = [...host.querySelectorAll("ol > li")];
    expect(items.length).toBe(8);
    expect(items.every(li => (li as HTMLElement).style.position !== "absolute")).toBe(true);
    expect(items[0].getAttribute("aria-label")).toContain("Étape 1 sur 8");
    expect([...host.querySelectorAll("button")].some(b => /Vue 3D/.test(b.textContent ?? ""))).toBe(false);
  });
  it("le rail garde le chemin positionné sur grand écran", async () => {
    media(false);
    await act(async () => root.render(<MemoryRouter><ProgressRail /></MemoryRouter>));
    expect(((host.querySelector("ol > li") as HTMLElement).style.position)).toBe("absolute");
  });
  it("les trois cartes de l'accueil utilisent une grille responsive plutôt qu'une grille en ligne fixe, et le module de découverte précède le rail", async () => {
    media(false);
    await act(async () => root.render(<MemoryRouter><HomePage /></MemoryRouter>));
    const cards = host.querySelector(".home-cards") as HTMLElement;
    expect(cards).not.toBeNull();
    expect(cards.style.gridTemplateColumns).toBe("");
    const discovery = host.querySelector("#decouverte")!;
    const rail = host.querySelector('[aria-label="Notre méthode"]')!;
    expect(discovery.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
