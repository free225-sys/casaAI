import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ConfirmDialog, EmptyState, Notice, PageHeader, Status } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import { adminRefusal } from "../../utils/adminErrors";
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

  const [toDelete, setToDelete] = useState<AdminLessonListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!toDelete) return;
    setError(null);
    setDeleting(true);
    try {
      await adminService.deleteLesson(toDelete.id);
      setToDelete(null);
      refresh();
    } catch (e) {
      setToDelete(null);
      setError(adminRefusal(e, "delete", "La suppression a échoué."));
    } finally {
      setDeleting(false);
    }
  };

  if (loadError) return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger le cours et ses leçons.</p><div className="page-actions"><button type="button" className="btn btn-secondary" onClick={refresh}>Réessayer le cours</button><Link to="/admin/courses">Retour aux cours</Link></div></div></AdminLayout>;

  const ordered = (lessons ?? []).slice().sort((a, b) => a.position - b.position);
  const quizLink = finalQuizId
    ? `/admin/quizzes/${finalQuizId}?back=${encodeURIComponent(`/admin/courses/${courseId}`)}`
    : `/admin/quizzes/new?kind=FINAL&course_id=${courseId}&back=${encodeURIComponent(`/admin/courses/${courseId}`)}`;

  return (
    <AdminLayout>
      <Link to="/admin/courses" className="admin-back">← Tous les cours</Link>
      <PageHeader
        title={course ? course.title : "Chargement…"}
        description={course ? <span className="ui-row"><Status value={course.status} /><span>{lessons ? `${lessons.length} leçon(s)` : ""}</span></span> : undefined}
        actions={courseId ? <>
          <Link to={quizLink} className="btn btn-secondary">{finalQuizId ? "Gérer le quiz final" : "+ Quiz final"}</Link>
          <Link to={`/admin/courses/${courseId}/lessons/new`} className="btn btn-primary">Nouvelle leçon</Link>
        </> : undefined}
      />

      {error && <Notice>{error}</Notice>}

      <section className="panel admin-list" aria-label="Leçons du cours">
        {lessons === null ? (
          <div className="admin-toolbar"><ListSkeleton count={4} /></div>
        ) : ordered.length === 0 ? (
          <EmptyState title="Aucune leçon pour l’instant" action={courseId && <Link to={`/admin/courses/${courseId}/lessons/new`} className="btn btn-primary">Nouvelle leçon</Link>}>
            Ajoutez une première leçon ; elle restera en brouillon jusqu’à sa publication.
          </EmptyState>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th scope="col" className="col-status">Statut</th><th scope="col">Leçon</th><th scope="col" className="col-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {ordered.map((l, index) => (
                <tr key={l.id}>
                  <td className="col-status"><Status value={l.status} /></td>
                  <td>
                    <span className="admin-title">{l.title}</span>
                    <span className="admin-sub">{[`Leçon ${index + 1}`, l.level].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="col-actions">
                    <div className="admin-actions">
                      <Link to={`/admin/preview/lessons/${l.id}`} className="btn btn-secondary" aria-label={`Aperçu de ${l.title}`}>Aperçu</Link>
                      <Link to={`/admin/courses/${courseId}/lessons/${l.id}`} className="btn btn-secondary">Éditer</Link>
                      <button type="button" className="btn btn-danger" onClick={() => setToDelete(l)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title={`Supprimer la leçon « ${toDelete.title} » ?`}
          confirmLabel="Supprimer définitivement"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        >
          <p>La leçon, ses sections et ses niveaux de profondeur seront supprimés définitivement.</p>
        </ConfirmDialog>
      )}
    </AdminLayout>
  );
}
