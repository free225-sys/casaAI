import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryModule } from "../src/components/discovery/DiscoveryModule";
import { GUIDED_EXAMPLES } from "../src/components/discovery/discoveryExamples";
import { SCENE_REGISTRY } from "../src/utils/discoveryRegistry";

vi.mock("../src/stores/authStore", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));

let host: HTMLDivElement;
let root: Root;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const button = (text: string) => [...host.querySelectorAll("button")].find(b => b.textContent === text) as HTMLButtonElement;

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("découverte : aucune entrée de simulation ne quitte le navigateur", () => {
  it("n'émet qu'une lecture GET des liens, sans corps ni en-tête d'authentification, et n'écrit aucun stockage pendant tout le parcours", async () => {
    const body = { discovery_key: "llm-answer", registry_version: 1, scenes: SCENE_REGISTRY.map(scene => ({ scene_key: scene.key, notion_ids: [], course_ids: [] })), notions: [], courses: [] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const storageBefore = JSON.stringify([localStorage, sessionStorage].map(store => Object.entries(store)));
    const cookieBefore = document.cookie;

    await act(async () => root.render(<MemoryRouter><DiscoveryModule /></MemoryRouter>));
    for (let i = 0; i < 100 && !host.querySelector(".discovery-sim"); i += 1) await flush();
    await flush();
    await click(button("Continuer : les 4 scènes suivantes"));
    await flush();
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    for (const radio of radios) await click(radio);
    for (let i = 0; i < 4; i += 1) await click(button("Calculer le token suivant"));
    await click(host.querySelectorAll<HTMLButtonElement>(".discovery-positions button")[2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/discoveries\/llm-answer\/links$/);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(JSON.stringify(init.headers ?? {})).not.toContain("Authorization");
    const everything = JSON.stringify(fetchMock.mock.calls);
    GUIDED_EXAMPLES.forEach(example => expect(everything).not.toContain(example.prompt));
    expect(JSON.stringify([localStorage, sessionStorage].map(store => Object.entries(store)))).toBe(storageBefore);
    expect(document.cookie).toBe(cookieBefore);
  });
});
