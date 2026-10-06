import { lazy, Suspense, useMemo, useRef } from "react";
import { useDiscoveryLinks } from "../../hooks/useDiscoveryLinks";
import { useNearViewport } from "../../hooks/useNearViewport";
import { SCENE_REGISTRY, type SceneKey } from "../../utils/discoveryRegistry";
import "../../styles/discovery.css";
import { DiscoveryBoundary } from "./DiscoveryBoundary";
import { INTRO_TEXT, INTRO_TITLE, SIMULATION_LABEL } from "./discoveryContent";
import { DiscoveryLinksBlock } from "./DiscoveryLinksBlock";
import { DiscoveryTextFallback } from "./DiscoveryTextFallback";
import type { SceneLinks } from "./DiscoverySimulation";

/** Chargé à la demande : le code de la simulation ne part qu'aux visiteurs qui s'approchent du module. */
const DiscoverySimulation = lazy(() => import("./DiscoverySimulation"));

/** Découverte pédagogique de l'accueil. La simulation est locale (trois exemples préécrits, aucune saisie ni appel à un modèle). Les seuls appels
 * réseau sont le chargement du module et la lecture groupée des liens publiés, déclenchés à l'approche du module. Le repli texte vit dans ce
 * bundle : il couvre l'échec de chargement comme l'échec d'exécution du module. */
export function DiscoveryModule() {
  const sectionRef = useRef<HTMLElement>(null);
  const near = useNearViewport(sectionRef);
  const { state, retry } = useDiscoveryLinks(near);

  const sceneLinks = useMemo<SceneLinks>(() => {
    if (state.status !== "ready") return {};
    const byId = new Map(state.links.courses.map(course => [course.id, course]));
    const result: SceneLinks = {};
    SCENE_REGISTRY.forEach((registered, index) => {
      const key: SceneKey = registered.key;
      const courses = state.links.scenes[index].course_ids.flatMap(id => { const course = byId.get(id); return course ? [{ id: course.id, title: course.title }] : []; });
      if (courses.length > 0) result[key] = courses;
    });
    return result;
  }, [state]);

  return (
    <section ref={sectionRef} className="discovery card" aria-labelledby="discovery-title" id="decouverte">
      <h2 id="discovery-title">{INTRO_TITLE}</h2>
      <p>{INTRO_TEXT}</p>
      <p className="discovery-label">{SIMULATION_LABEL}</p>
      <DiscoveryBoundary fallback={<DiscoveryTextFallback failed />}>
        {near ? (
          <Suspense fallback={<div className="discovery-placeholder" role="status">Chargement de la simulation…</div>}>
            <DiscoverySimulation sceneLinks={sceneLinks} />
          </Suspense>
        ) : (
          <div className="discovery-placeholder" aria-hidden="true" />
        )}
      </DiscoveryBoundary>
      <DiscoveryLinksBlock state={state} retry={retry} />
    </section>
  );
}
