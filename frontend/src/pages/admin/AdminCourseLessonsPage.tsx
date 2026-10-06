import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { RevealSection } from "../../components/RevealSection";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import type { AdminCourse, AdminLessonListItem } from "../../types/api";

export function AdminCourseLessonsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [lessons, setLessons] = useState<AdminLessonListItem[] | null>(null);
  const [finalQuizId, setFinalQuizId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const refresh = () => setReload(value => value + 1);
  useEffect(() => {
    if (!courseId) return;
    let active = true;
    setLoadError(false); setLessons(null); setCourse(null); setFinalQuizId(null);
    Promise.all([adminService.getCourse(courseId), adminService.listLessons(courseId), adminService.listQuizzes({ courseId })])
      .then(([course, lessons, quizzes]) => { if (active) { setCourse(course); setLessons(lessons.items); setFinalQuizId(quizzes.items[0]?.id ?? null); } })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [courseId, reload]);

  const handleDelete = async (lessonId: string, title: string) => {
    if (!confirm(`Supprimer la leçon "${title}" ?`)) return;
    setError(null);
    try {
      await adminService.deleteLesson(lessonId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  if (loadError) return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger le cours et ses leçons.</p><button type="button" className="btn btn-secondary" onClick={refresh}>Réessayer le cours</button><Link to="/admin/courses">Retour aux cours</Link></div></AdminLayout>;

  return (
    <AdminLayout>
      <Link to="/admin/courses" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
        ← Tous les cours
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 24px" }}>
        <h2 style={{ fontSize: "1.1rem" }}>{course ? course.title : "Chargement…"}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {courseId && (
            <Link
              to={
                finalQuizId
                  ? `/admin/quizzes/${finalQuizId}?back=${encodeURIComponent(`/admin/courses/${courseId}`)}`
                  : `/admin/quizzes/new?kind=FINAL&course_id=${courseId}&back=${encodeURIComponent(`/admin/courses/${courseId}`)}`
              }
              className="btn btn-secondary"
            >
              {finalQuizId ? "Gérer le quiz final" : "+ Quiz final"}
            </Link>
          )}
          {courseId && (
            <Link to={`/admin/courses/${courseId}/lessons/new`} className="btn btn-primary">
              Nouvelle leçon
            </Link>
          )}
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      {lessons === null ? (
        <ListSkeleton count={4} />
      ) : lessons.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <p>Aucune leçon pour l'instant.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lessons
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((l, i) => (
              <RevealSection key={l.id} as="div" delayMs={Math.min(i, 8) * 40}>
                <div className="card admin-row" style={{ padding: "14px 18px" }}>
                  <span className="mono" style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                    {l.position}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: l.status === "PUBLISHED" ? "var(--color-accent-teal-soft)" : "var(--color-accent-gold-soft)",
                      color: l.status === "PUBLISHED" ? "var(--color-accent-teal)" : "var(--color-accent-gold)",
                    }}
                  >
                    {l.status}
                  </span>
                  <span style={{ flex: 1, color: "var(--color-text)" }}>{l.title}</span>
                  <Link to={`/admin/courses/${courseId}/lessons/${l.id}`} className="btn btn-secondary">
                    Éditer
                  </Link>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDelete(l.id, l.title)}
                    style={{ color: "var(--color-accent-coral)" }}
                  >
                    Supprimer
                  </button>
                </div>
              </RevealSection>
            ))}
        </div>
      )}
    </AdminLayout>
  );
}
