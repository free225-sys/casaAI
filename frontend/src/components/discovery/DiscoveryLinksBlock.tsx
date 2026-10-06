import { Link } from "../AppLink";
import { useAuth } from "../../stores/authStore";
import type { DiscoveryLinksState } from "../../hooks/useDiscoveryLinks";

/** Cours reliés à la découverte par les associations notion → leçon publiées. Chaque état a son texte : chargement, panne réessayable, registre
 * incompatible, aucun cours associé, liste. Une panne n'est jamais présentée comme « aucun cours » ni comme une dépublication. */
export function DiscoveryLinksBlock({ state, retry }: { state: DiscoveryLinksState; retry: () => void }) {
  const { isAuthenticated } = useAuth();
  if (state.status === "idle" || state.status === "loading") {
    return <p role="status" className="discovery-hint">Chargement des cours associés…</p>;
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="section-error">
        <p>Impossible de charger les cours associés pour le moment. La simulation reste utilisable.</p>
        <button type="button" className="btn btn-secondary" onClick={retry}>Réessayer : cours associés</button>
      </div>
    );
  }
  if (state.status === "incompatible") {
    return (
      <div role="alert" className="section-error">
        <p>Liens momentanément incompatibles. Réessayez après actualisation.</p>
        <button type="button" className="btn btn-secondary" onClick={retry}>Réessayer : cours associés</button>
      </div>
    );
  }
  const { courses } = state.links;
  if (courses.length === 0) {
    return (
      <p className="discovery-hint">Aucun cours n’est associé à cette découverte pour le moment. <Link to="/catalog">Explorer le catalogue</Link>.</p>
    );
  }
  return (
    <div className="discovery-courses">
      <h3>Pour aller plus loin</h3>
      <ul>
        {courses.map(course => (
          <li key={course.id}>
            <Link to={`/courses/${encodeURIComponent(course.id)}`}>{course.title}</Link>
            <span className="discovery-hint">{[course.level, course.duration_min ? `${course.duration_min} min` : null].filter(Boolean).join(" · ")}</span>
            {!isAuthenticated && <Link to="/register" state={{ return_course_id: course.id }} className="discovery-follow">Créer un compte pour suivre ce cours</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
