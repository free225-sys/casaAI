import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { RootLayout } from "../src/layouts/RootLayout";

vi.mock("../src/components/Nav", () => ({ Nav: () => <nav /> }));

it("le pied de page partagé porte une seule signature Relais IT, lien natif sûr", async () => {
  const host = document.createElement("div"); document.body.append(host);
  await act(async () => createRoot(host).render(<MemoryRouter initialEntries={["/login"]}><RootLayout><p>contenu</p></RootLayout></MemoryRouter>));
  const links = [...host.querySelectorAll<HTMLAnchorElement>('a[href*="relaisit.com"]')];
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute("href")).toBe("http://www.relaisit.com/");
  expect(links[0].rel).toContain("noopener");
  expect(host.querySelector("footer")!.textContent).toContain("Propulsé par Relais IT");
  expect(host.querySelector("footer")!.textContent).not.toMatch(/©|droits réservés/i);
});
