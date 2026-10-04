import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { LessonDocumentView } from "../../components/LessonDocumentView";
import { MiniDiagram } from "../../components/MiniDiagram";
import { Notice, PageHeader, Status } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ApiError, API_BASE_URL } from "../../services/apiClient";
import { adminService } from "../../services/adminService";
import type { AdminLesson, LessonDocument } from "../../types/api";

const DEPTH_LABELS: Record<string, string> = { ESSENTIAL: "Essentiel", TECHNICAL: "Technique", MATHEMATICS: "Mathématiques", IMPLEMENTATION: "Implémentation", ARCHITECTURE: "Architecture", GOVERNANCE: "Gouvernance" };

function imageSrc(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
}

/** Aperçu administratif d'une leçon : lecture seule, brouillons compris, soumise au périmètre. Aucune progression, aucun badge, aucune
 * tentative n'est créé ; aucun appel aux services pédagogiques. Ce n'est pas la page que lit l'apprenant (`LessonPage`). */
export function AdminPreviewLessonPage() {
  const params = useParams();
  return <Content key={params.lessonId} />;
}

function Content() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [lesson, setLesson] = useState<AdminLesson | null>(null);
  const [document, setDocument] = useState<LessonDocument | null>(null);
  const [documentError, setDocumentError] = useState(false);
  const [error, setError] = useState<"notfound" | "forbidden" | "failed" | null>(null);
  const [reload, setReload] = useState(0);
  const retry = useCallback(() => setReload(value => value + 1), []);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    setError(null); setLesson(null); setDocument(null); setDocumentError(false);
    adminService.previewLesson(lessonId)
      .then(value => { if (active) setLesson(value); })
      .catch(e => { if (active) setError(e instanceof ApiError && e.status === 404 ? "notfound" : e instanceof ApiError && e.status === 403 ? "forbidden" : "failed"); });
    adminService.previewLessonDocument(lessonId)
      .then(value => { if (active) setDocument(value); })
      .catch(e => { if (active && !(e instanceof ApiError && e.status === 404)) setDocumentError(true); });
    return () => { active = false; };
  }, [lessonId, reload]);

  if (error === "notfound") return <AdminLayout><Notice>Cette leçon est introuvable ou hors de votre périmètre.</Notice><Link to="/admin/courses" className="admin-back">Retour aux cours</Link></AdminLayout>;
  if (error === "forbidden") return <AdminLayout><Notice>L’aperçu est réservé aux comptes d’administration.</Notice></AdminLayout>;
  if (error === "failed") return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger l’aperçu de cette leçon.</p><button type="button" className="btn btn-secondary" onClick={retry}>Réessayer l’aperçu</button></div></AdminLayout>;
  if (!lesson) return <AdminLayout><ListSkeleton count={4} height={44} /></AdminLayout>;

  return (
    <AdminLayout>
      <Link to={`/admin/courses/${lesson.course_id}/lessons/${lesson.id}`} className="admin-back">← Retour à l’éditeur de la leçon</Link>
      <PageHeader title={lesson.title} description={[lesson.level, lesson.duration_min ? `${lesson.duration_min} min` : null].filter(Boolean).join(" · ") || undefined} actions={<Status value={lesson.status === "PUBLISHED" ? "PUBLISHED" : lesson.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT"} />} />
      <Notice kind="info"><p>Aperçu administratif en lecture seule. Il montre le contenu, brouillons compris, sans créer de progression, de badge ni de tentative. Un apprenant ne voit cette leçon qu’une fois la leçon et son cours publiés.</p></Notice>

      <div className="editor">
        {lesson.summary && <p>{lesson.summary}</p>}
        {lesson.objectives.length > 0 && (
          <section className="panel editor-panel" aria-labelledby="preview-objectives">
            <h2 id="preview-objectives">Objectifs</h2>
            <ul>{lesson.objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul>
          </section>
        )}
        {lesson.sections.map((section, index) => (
          <section key={index} className="panel editor-panel" aria-labelledby={`preview-section-${index}`}>
            <h2 id={`preview-section-${index}`}>{section.title || `Section ${index + 1}`}</h2>
            {section.body.split(/\n{2,}/).map((paragraph, i) => <p key={i} style={{ whiteSpace: "pre-wrap" }}>{paragraph}</p>)}
            {section.diagram && <MiniDiagram data={section.diagram} />}
            {section.image_url && <img src={imageSrc(section.image_url)} alt={section.image_alt ?? ""} style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)" }} />}
          </section>
        ))}
        {lesson.depth_levels.length > 0 && (
          <section className="panel editor-panel" aria-labelledby="preview-depth">
            <h2 id="preview-depth">Pour approfondir</h2>
            {lesson.depth_levels.map((level, index) => (
              <div key={index} className="subpanel">
                <h3>{level.label || DEPTH_LABELS[level.depth_key] || level.depth_key}{level.title ? ` : ${level.title}` : ""}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{level.body}</p>
              </div>
            ))}
          </section>
        )}
        {lesson.example && <section className="panel editor-panel" aria-labelledby="preview-example"><h2 id="preview-example">Exemple</h2><p>{lesson.example}</p></section>}
        {lesson.sections.length === 0 && lesson.objectives.length === 0 && !lesson.summary && <Notice kind="warning"><p>Cette leçon n’a encore aucun contenu.</p></Notice>}
        {documentError && <div role="alert" className="section-error"><p>Le document d’origine n’a pas pu être chargé.</p><button type="button" className="btn btn-secondary" onClick={retry}>Réessayer le document</button></div>}
        {document && <section aria-labelledby="preview-document"><h2 id="preview-document">Document d’origine importé</h2><LessonDocumentView sections={document.sections} /></section>}
      </div>
    </AdminLayout>
  );
}
