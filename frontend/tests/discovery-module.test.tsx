import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryModule } from "../src/components/discovery/DiscoveryModule";
import { SCENE_TEXTS } from "../src/components/discovery/discoveryContent";
import { GUIDED_EXAMPLES, stepProbabilities } from "../src/components/discovery/discoveryExamples";
import { ApiError } from "../src/services/apiClient";
import { discoveryService } from "../src/services/discoveryService";
import { SCENE_REGISTRY, validateDiscoveryLinks } from "../src/utils/discoveryRegistry";

const auth = vi.hoisted(() => ({ authenticated: false }));
vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ isAuthenticated: auth.authenticated, user: null }) }));
vi.mock("../src/services/discoveryService", () => ({ discoveryService: { getLinks: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;

const links = (over: Record<string, unknown> = {}) => ({
  discovery_key: "llm-answer",
  registry_version: 1,
  scenes: SCENE_REGISTRY.map(scene => ({ scene_key: scene.key, notion_ids: [] as string[], course_ids: [] as string[] })),
  notions: [] as unknown[],
  courses: [] as unknown[],
  ...over,
});
const withCourse = () => {
  const data = links({ notions: [{ id: "llm", title: "Modèle de langage" }], courses: [{ id: "cours-test", title: "Cours TEST", school_id: "s", level: "N1", duration_min: 30 }] });
  data.scenes[0] = { scene_key: "message", notion_ids: ["llm"], course_ids: ["cours-test"] };
  data.scenes[5] = { scene_key: "response", notion_ids: ["llm"], course_ids: ["cours-test"] };
  return data;
};
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const button = (text: string) => { const el = [...host.querySelectorAll("button")].find(b => b.textContent === text); if (!el) throw new Error(`Missing button: ${text}`); return el as HTMLButtonElement; };
const mount = async () => {
  await act(async () => root.render(<MemoryRouter><DiscoveryModule /></MemoryRouter>));
  // Le module de simulation est chargé à la demande : on attend son affichage (la première importation est la plus lente).
  for (let i = 0; i < 100 && !host.querySelector(".discovery-sim"); i += 1) await flush();
  await flush();
};
const headings = () => [...host.querySelectorAll("h3")].map(h => h.textContent ?? "");

beforeEach(() => {
  vi.resetAllMocks();
  auth.authenticated = false;
  // happy-dom n'a pas toujours d'IntersectionObserver : sans lui le module démarre aussitôt, comme sur un navigateur ancien.
  vi.stubGlobal("IntersectionObserver", undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(discoveryService.getLinks).mockResolvedValue(links());
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("registre : validation de la réponse des liens", () => {
  it("accepte une réponse cohérente avec cours et notions référencés par une scène", () => {
    expect(validateDiscoveryLinks(withCourse())).not.toBeNull();
  });
  it("accepte la version 1 et un sous-ensemble ordonné de notions (une notion non publiée est absente)", () => {
    expect(validateDiscoveryLinks(links())).not.toBeNull();
    const partial = links({ notions: [{ id: "embeddings", title: "Embeddings" }] });
    partial.scenes[2] = { scene_key: "representations", notion_ids: ["embeddings"], course_ids: [] };
    expect(validateDiscoveryLinks(partial)).not.toBeNull();
  });
  it.each([
    ["version inconnue", () => links({ registry_version: 2 })],
    ["clé de découverte inconnue", () => links({ discovery_key: "autre" })],
    ["cinq scènes", () => { const d = links(); d.scenes.pop(); return d; }],
    ["scènes dans un autre ordre", () => { const d = links(); [d.scenes[0], d.scenes[1]] = [d.scenes[1], d.scenes[0]]; return d; }],
    ["clé de scène renommée", () => { const d = links(); d.scenes[3] = { ...d.scenes[3], scene_key: "calcul" }; return d; }],
    ["notion hors du registre pour la scène", () => { const d = links({ notions: [{ id: "agents", title: "Agents" }] }); d.scenes[1] = { scene_key: "tokens", notion_ids: ["agents"], course_ids: [] }; return d; }],
    ["notions dans un autre ordre", () => { const d = links({ notions: [{ id: "attention", title: "A" }, { id: "transformer", title: "T" }] }); d.scenes[3] = { scene_key: "model", notion_ids: ["transformer", "attention"], course_ids: [] }; return d; }],
    ["notion sans métadonnées", () => { const d = links(); d.scenes[0] = { scene_key: "message", notion_ids: ["llm"], course_ids: [] }; return d; }],
    ["cours référencé sans métadonnées", () => { const d = links(); d.scenes[0] = { scene_key: "message", notion_ids: [], course_ids: ["x"] }; return d; }],
    ["cours dupliqué", () => links({ courses: [{ id: "a", title: "A", school_id: "s", level: null, duration_min: null }, { id: "a", title: "A", school_id: "s", level: null, duration_min: null }] })],
    ["niveau de type invalide", () => links({ courses: [{ id: "a", title: "A", school_id: "s", level: 3, duration_min: null }] })],
    ["cours orphelin (métadonnées jamais référencées par une scène)", () => links({ courses: [{ id: "orphelin", title: "Cours orphelin", school_id: "s", level: null, duration_min: null }] })],
    ["notion orpheline (métadonnées jamais référencées par une scène)", () => links({ notions: [{ id: "llm", title: "Modèle de langage" }] })],
    ["un cours référencé et un autre orphelin", () => { const d = withCourse(); d.courses.push({ id: "orphelin", title: "Orphelin", school_id: "s", level: null, duration_min: null } as never); return d; }],
    ["pas un objet", () => "texte" as never],
    ["tableau vide fabriqué", () => [] as never],
  ])("refuse : %s", (_name, build) => { expect(validateDiscoveryLinks(build())).toBeNull(); });
});

describe("textes finaux et exemples", () => {
  it("reprend les formulations du contrat et ne dit plus « prudent »", () => {
    const all = SCENE_TEXTS.map(scene => scene.text + (scene.note ?? "")).join(" ");
    expect(SCENE_TEXTS.map(scene => scene.key)).toEqual(SCENE_REGISTRY.map(scene => scene.key));
    expect(all).toContain("un token peut représenter un mot, une partie de mot ou un signe");
    expect(all).toContain("sans regarder les tokens futurs");
    expect(all).toContain("ne supprime pas le travail sur le contexte");
    expect(all).toContain("Une réponse plausible peut être inexacte");
    expect(all.toLowerCase()).not.toContain("prudent");
    expect(all).not.toContain("N²");
  });
  it("les probabilités illustratives somment à 1 et la variété aplatit la répartition", () => {
    const step = GUIDED_EXAMPLES[0].steps[0];
    const low = stepProbabilities(step, 0);
    const high = stepProbabilities(step, 100);
    expect(low.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(high.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(low[0]).toBeGreaterThan(high[0]);
  });
});

describe("module de découverte dans l'accueil", () => {
  it("montre deux scènes, puis déplie les quatre suivantes sur place avec focus et annonce", async () => {
    await mount();
    expect(headings().length).toBe(2);
    expect(headings()[0]).toContain("Votre message");
    expect(host.textContent).toContain("Simulation illustrative, sans appel à un modèle.");
    const more = button("Continuer : les 4 scènes suivantes");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    await click(more);
    await flush();
    expect(headings().length).toBe(6);
    expect(host.textContent).not.toContain("Continuer : les 4 scènes suivantes");
    expect(document.activeElement?.textContent).toContain("Des fragments aux nombres");
    expect(host.querySelector('[role="status"].sr-only')?.textContent).toContain("Scènes 3 à 6 affichées");
    SCENE_TEXTS.forEach(scene => expect(host.textContent).toContain(scene.text));
  });
  it("n'a aucune saisie libre : seulement des choix guidés, trois exemples", async () => {
    await mount();
    await click(button("Continuer : les 4 scènes suivantes"));
    await flush();
    expect(host.querySelectorAll('input[type="text"], input[type="search"], textarea, input:not([type])').length).toBe(0);
    expect(host.querySelectorAll('input[type="radio"]').length).toBe(3);
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    await click(radios[1]);
    expect(host.textContent).toContain("Écris un mail pour reporter une réunion.");
  });
  it("scène 4 : une position n'utilise que les tokens précédents et elle-même, jamais les suivants", async () => {
    await mount();
    await click(button("Continuer : les 4 scènes suivantes"));
    await flush();
    const positions = [...host.querySelectorAll<HTMLButtonElement>(".discovery-positions button")];
    await click(positions[4]);
    expect(host.textContent).toContain("Position 5");
    expect(host.textContent).toContain("utilise les tokens 1 à 5");
    expect(host.textContent).toContain(`n’utilise aucun des ${GUIDED_EXAMPLES[0].promptTokens.length - 5} tokens suivants`);
    const states = [...host.querySelectorAll(".discovery-positions li")].map(li => li.textContent ?? "");
    expect(states.slice(0, 4).every(text => text.includes("utilisé") && !text.includes("non utilisé"))).toBe(true);
    expect(states[5]).toContain("non utilisé");
  });
  it("scène 5 : le token suivant se calcule pas à pas et le réglage change les probabilités affichées", async () => {
    await mount();
    await click(button("Continuer : les 4 scènes suivantes"));
    await flush();
    expect(button("Calculer le token suivant").disabled).toBe(false);
    await click(button("Calculer le token suivant"));
    expect(host.textContent).toContain("« Une »");
    expect(host.textContent).toContain("(retenu ici)");
    const pct = () => [...host.querySelectorAll(".discovery-pct")].map(el => Number.parseInt(el.textContent ?? "0", 10));
    const range = host.querySelector<HTMLInputElement>('input[type="range"]')!;
    const setRange = (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(range, value); range.dispatchEvent(new Event("input", { bubbles: true })); range.dispatchEvent(new Event("change", { bubbles: true })); });
    await setRange("0");
    const low = pct();
    await setRange("100");
    const high = pct();
    expect(low[0]).toBeGreaterThan(high[0]);
    expect(host.textContent).toContain("moins varié");
    expect(host.textContent).not.toContain("prudent");
    for (let i = 0; i < 10; i += 1) { if (!button("Calculer le token suivant").disabled) await click(button("Calculer le token suivant")); }
    expect(button("Calculer le token suivant").disabled).toBe(true);
    expect(host.textContent).toContain("(fin)");
    await click(button("Recommencer"));
    expect(host.textContent).toContain("aucun token pour l’instant");
  });
});

describe("liens publiés : états distincts", () => {
  it("lit les liens une seule fois, affiche les cours dédupliqués et propose de créer un compte aux visiteurs", async () => {
    vi.mocked(discoveryService.getLinks).mockResolvedValue(withCourse());
    await mount();
    expect(discoveryService.getLinks).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Pour aller plus loin");
    const anchors = [...host.querySelectorAll<HTMLAnchorElement>('a[href="/courses/cours-test"]')];
    expect(anchors.length).toBeGreaterThanOrEqual(2); // bloc de cours + rappel sous la scène 1
    expect(host.querySelectorAll(".discovery-courses li").length).toBe(1); // un seul cours dans le bloc malgré deux scènes
    expect(host.querySelector('a[href="/register"]')?.textContent).toContain("Créer un compte pour suivre ce cours");
  });
  it("n'invite pas à créer un compte quand la personne est déjà connectée", async () => {
    auth.authenticated = true;
    vi.mocked(discoveryService.getLinks).mockResolvedValue(withCourse());
    await mount();
    expect(host.querySelector('a[href="/register"]')).toBeNull();
  });
  it("aucun cours associé : état vide propre, distinct d'une panne", async () => {
    await mount();
    expect(host.textContent).toContain("Aucun cours n’est associé à cette découverte pour le moment.");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it("une panne est réessayable et n'est jamais présentée comme « aucun cours »", async () => {
    vi.mocked(discoveryService.getLinks).mockRejectedValueOnce(new ApiError(500, "panne")).mockResolvedValue(withCourse());
    await mount();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Impossible de charger les cours associés");
    expect(host.textContent).not.toContain("Aucun cours n’est associé");
    expect(headings().length).toBe(2); // les scènes restent utilisables
    await click(button("Réessayer : cours associés"));
    await flush();
    expect(host.textContent).toContain("Pour aller plus loin");
    expect(discoveryService.getLinks).toHaveBeenCalledTimes(2);
  });
  it("une réponse avec un cours orphelin n'affiche aucun lien : incompatible, jamais une source de liens", async () => {
    vi.mocked(discoveryService.getLinks).mockResolvedValue(links({ courses: [{ id: "orphelin", title: "Cours orphelin", school_id: "s", level: null, duration_min: null }] }));
    await mount();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Liens momentanément incompatibles");
    expect(host.textContent).not.toContain("Cours orphelin");
    expect(host.querySelector('a[href="/courses/orphelin"]')).toBeNull();
  });
  it("un registre d'une autre version affiche l'incompatibilité, sans liens ni faux état vide, scènes toujours utilisables", async () => {
    vi.mocked(discoveryService.getLinks).mockResolvedValue({ ...withCourse(), registry_version: 2 });
    await mount();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Liens momentanément incompatibles. Réessayez après actualisation.");
    expect(host.textContent).not.toContain("Pour aller plus loin");
    expect(host.textContent).not.toContain("Cours TEST");
    expect(host.textContent).not.toContain("Aucun cours n’est associé");
    await click(button("Continuer : les 4 scènes suivantes"));
    await flush();
    expect(headings().length).toBe(6);
  });
});

describe("réseau et approche de l'écran", () => {
  it("ne lit les liens qu'une fois le module approché de l'écran", async () => {
    let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: typeof notify) { notify = cb; } observe() {} disconnect() {} });
    await mount();
    expect(discoveryService.getLinks).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("Votre message");
    await act(async () => notify([{ isIntersecting: true }]));
    await flush();
    expect(discoveryService.getLinks).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Votre message");
  });
});
