import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../services/apiClient";
import { homePathFor } from "../utils/roles";
import { Link } from "../components/AppLink";
import { RevealSection } from "../components/RevealSection";
import { SchoolIcon } from "../components/ModuleIcon";
import { CourseSkeleton } from "../components/Skeleton";
import { useAuth } from "../stores/authStore";
import { contentService } from "../services/contentService";
import { certificationService } from "../services/certificationService";
import type { CourseCertificateEligibility, CourseDetail } from "../types/api";

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { isAuthenticated, user } = useAuth();
  // Lot 1 : certificats et progression personnels réservés aux apprenants ; un administrateur n'a ni lien « Ouvrir » ni quiz (l'aperçu viendra avec le Lot 4).
  const isLearner = user?.role === "LEARNER";
  // Trois états distincts : le cours (ou son identifiant) a changé de statut, il n'est plus disponible (404), ou la lecture a échoué (réseau, 5xx), ce qui n'est jamais un retrait.
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "unavailable" | "error">("loading");
  const [reload, setReload] = useState(0);
  const [eligibility, setEligibility] = useState<CourseCertificateEligibility | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    setCourse(null);
    setLoadState("loading");
    contentService
      .getCourse(courseId)
      .then(value => { if (active) setCourse(value); })
      .catch(error => { if (active) setLoadState(error instanceof ApiError && error.status === 404 ? "unavailable" : "error"); });
    return () => { active = false; };
  }, [courseId, reload]);

  useEffect(() => {
    if (!courseId || !isLearner) return;
    certificationService
      .getCourseCertificateEligibility(courseId)
      .then(setEligibility)
      .catch(() => setEligibility(null));
  }, [courseId, isLearner]);

  if (loadState === "unavailable") {
    return (
      <div className="section-error" role="status">
        <h1 style={{ fontSize: "1.4rem" }}>Ce cours n’est plus disponible</h1>
        <p>Il a pu être retiré ou dépublié. Vous pouvez en trouver d’autres dans le catalogue.</p>
        <p className="ui-row">
          <Link to="/catalog" className="btn btn-primary">Voir le catalogue</Link>
          <Link to={user ? homePathFor(user.role) : "/"} className="btn btn-secondary">{user ? "Mon espace" : "Accueil"}</Link>
        </p>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div className="section-error" role="alert">
        <p>Impossible de charger ce cours pour le moment. Ce n’est pas un retrait : réessayez dans un instant.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer : ce cours</button>
      </div>
    );
  }
  if (!course) return <CourseSkeleton />;

  const accent = course.color ?? "var(--color-accent-gold)";

  return (
    <div className="course-content">
      <RevealSection as="div">
        <SchoolIcon schoolId={course.school_id} color={accent} />

        <h1 style={{ marginBottom: 16 }}>{course.title}</h1>
        {course.description && (
          <p style={{ marginBottom: 40, fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--color-text)" }}>
            {course.description}
          </p>
        )}
      </RevealSection>

      <h2 style={{ marginBottom: 16 }}>
        Leçons <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>({course.lessons.length})</span>
      </h2>

      <ol style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {course.lessons.map((lesson, i) => (
          <RevealSection
            key={lesson.id}
            as="li"
            delayMs={Math.min(i, 6) * 50}
            className="card"
            style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 18 }}
          >
            <span className="mono" style={{ color: "var(--color-text-muted)", fontSize: "0.95rem", fontWeight: 600 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ color: "var(--color-text)", fontWeight: 500, fontSize: "1rem" }}>{lesson.title}</p>
              {lesson.duration_min && (
                <p style={{ fontSize: "0.8rem" }}>{lesson.duration_min} min</p>
              )}
            </div>
            {isAuthenticated ? (
              isLearner ? (
                <Link to={`/app/lessons/${lesson.id}`} className="btn btn-secondary">
                  Ouvrir
                </Link>
              ) : null
            ) : (
              <Link to="/login" className="btn btn-secondary">
                Se connecter
              </Link>
            )}
          </RevealSection>
        ))}
      </ol>

      {course.final_quiz_id && (
        <RevealSection as="div" className="card" style={{ padding: 24, marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Quiz final</h3>
            <p style={{ fontSize: "0.88rem" }}>Validez l'ensemble des acquis de ce cours.</p>
          </div>
          {(!isAuthenticated || isLearner) && (
            <Link
              to={isAuthenticated ? `/app/quizzes/${course.final_quiz_id}` : "/login"}
              className="btn btn-primary"
              style={{ flexShrink: 0 }}
            >
              {isAuthenticated ? "Passer le quiz final" : "Se connecter"}
            </Link>
          )}
        </RevealSection>
      )}

      {eligibility && eligibility.quizzes.length > 0 && (
        <RevealSection as="div" className="card" style={{ padding: 24, marginTop: 32 }}>
          <h3 style={{ marginBottom: 6 }}>Résultats aux quiz du cours</h3>
          <p style={{ fontSize: "0.88rem", marginBottom: 18 }}>
            Calcul indicatif : une moyenne d'au moins {eligibility.threshold}% aux quiz de ce cours ne délivre plus de certificat
            automatiquement. La certification officielle est une décision de CASA Institut, à{" "}
            <Link to="/app/certifications">demander depuis les certifications</Link>.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {eligibility.quizzes.map((q) => (
              <div
                key={q.quiz_id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}
              >
                <span>{q.quiz_title}</span>
                <span
                  className="mono"
                  style={{ color: q.attempted ? "var(--color-accent-teal)" : "var(--color-text-muted)" }}
                >
                  {q.attempted ? `${q.best_score}%` : "non tenté"}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: "0.9rem" }}>
              Moyenne{eligibility.all_attempted ? "" : " partielle"} :{" "}
              {eligibility.average_score !== null ? `${eligibility.average_score}%` : "—"}
              {!eligibility.all_attempted && " (quiz restants)"}
            </span>

            {eligibility.already_issued && (
              <span className="badge badge-teal">
                Certificat historique délivré {eligibility.issued_at && `le ${new Date(eligibility.issued_at).toLocaleDateString("fr-FR")}`}
              </span>
            )}
          </div>
        </RevealSection>
      )}

      {course.resources.length > 0 && (
        <RevealSection as="div" style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 16 }}>Bibliographie</h2>
          <p style={{ fontSize: "0.85rem", marginBottom: 16 }}>
            Sources utilisées pour rédiger le contenu de ce cours.
          </p>
          <ol style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {course.resources.map((r) => (
              <li key={r.id} className="card" style={{ padding: "14px 18px" }}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent-blue)", fontWeight: 500 }}>
                    {r.title}
                  </a>
                ) : (
                  <span style={{ color: "var(--color-text)", fontWeight: 500 }}>{r.title}</span>
                )}
                <p style={{ fontSize: "0.8rem", marginTop: 4 }}>
                  {[r.publisher, r.year, r.type].filter(Boolean).join(" · ")}
                </p>
                {r.description && <p style={{ fontSize: "0.82rem", marginTop: 6 }}>{r.description}</p>}
              </li>
            ))}
          </ol>
        </RevealSection>
      )}
    </div>
  );
}
