import { useCallback, useEffect, useState } from "react";
import { discoveryService } from "../services/discoveryService";
import type { DiscoveryLinks } from "../types/api";
import { validateDiscoveryLinks } from "../utils/discoveryRegistry";

export type DiscoveryLinksState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "incompatible" }
  | { status: "ready"; links: DiscoveryLinks };

/** Une seule lecture groupée quand `enabled` devient vrai, sans cache persistant ; `retry` relit explicitement. Une réponse qui n'est pas du
 * registre version 1 donne `incompatible` (jamais un état vide) ; une panne donne `error` (jamais `[]` fabriqué). */
export function useDiscoveryLinks(enabled: boolean): { state: DiscoveryLinksState; retry: () => void } {
  const [state, setState] = useState<DiscoveryLinksState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: "loading" });
    discoveryService.getLinks().then(data => {
      if (!active) return;
      const links = validateDiscoveryLinks(data);
      setState(links ? { status: "ready", links } : { status: "incompatible" });
    }).catch(() => { if (active) setState({ status: "error" }); });
    return () => { active = false; };
  }, [enabled, attempt]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { state, retry };
}
