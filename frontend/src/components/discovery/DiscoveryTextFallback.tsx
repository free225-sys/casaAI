import { SCENE_TEXTS } from "./discoveryContent";

/** Version texte des six scènes, rendue par l'application elle-même : sans animation, sans module chargé à la demande. */
export function DiscoveryTextFallback({ failed = false }: { failed?: boolean }) {
  return (
    <div className="discovery-fallback">
      {failed && <p role="status" className="discovery-hint">La simulation n’a pas pu s’afficher. Voici le texte des six scènes ; rechargez la page pour réessayer.</p>}
      <ol className="discovery-text-list">
        {SCENE_TEXTS.map(scene => (
          <li key={scene.key}>
            <h3>{scene.title}</h3>
            <p>{scene.text}</p>
            {scene.note && <p className="discovery-hint">{scene.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
