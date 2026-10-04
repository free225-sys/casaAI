import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { Notice, PageHeader, Status } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ApiError } from "../../services/apiClient";
import { adminService } from "../../services/adminService";
import type { AdminQuiz } from "../../types/api";

/** Aperçu administratif d'un quiz avec son corrigé : lecture seule, aucune réponse saisissable, aucune tentative enregistrée.
 * La bonne réponse est signalée par un texte (« Bonne réponse »), jamais par la couleur seule. */
export function AdminPreviewQuizPage() {
  const params = useParams();
  return <Content key={params.quizId} />;
}

function Content() {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<AdminQuiz | null>(null);
  const [error, setError] = useState<"notfound" | "forbidden" | "failed" | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!quizId) return;
    let active = true;
    setError(null); setQuiz(null);
    adminService.previewQuiz(quizId)
      .then(value => { if (active) setQuiz(value); })
      .catch(e => { if (active) setError(e instanceof ApiError && e.status === 404 ? "notfound" : e instanceof ApiError && e.status === 403 ? "forbidden" : "failed"); });
    return () => { active = false; };
  }, [quizId, reload]);

  if (error === "notfound") return <AdminLayout><Notice>Ce quiz est introuvable ou hors de votre périmètre.</Notice><Link to="/admin/courses" className="admin-back">Retour aux cours</Link></AdminLayout>;
  if (error === "forbidden") return <AdminLayout><Notice>L’aperçu est réservé aux comptes d’administration.</Notice></AdminLayout>;
  if (error === "failed") return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger l’aperçu de ce quiz.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer l’aperçu</button></div></AdminLayout>;
  if (!quiz) return <AdminLayout><ListSkeleton count={4} height={44} /></AdminLayout>;

  return (
    <AdminLayout>
      <Link to={`/admin/quizzes/${quiz.id}`} className="admin-back">← Retour à l’éditeur du quiz</Link>
      <PageHeader title={quiz.title} description={`Seuil de réussite : ${quiz.pass_threshold} % · ${quiz.questions.length} question${quiz.questions.length > 1 ? "s" : ""}`} actions={<Status value={quiz.status === "PUBLISHED" ? "PUBLISHED" : quiz.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT"} />} />
      <Notice kind="info"><p>Aperçu administratif avec corrigé, en lecture seule. Aucune tentative, aucun score et aucun badge ne sont enregistrés. Un apprenant ne voit ce quiz qu’une fois ses parents publiés.</p></Notice>
      <div className="editor">
        {quiz.questions.length === 0 && <Notice kind="warning"><p>Ce quiz n’a encore aucune question.</p></Notice>}
        {quiz.questions.map((question, index) => (
          <section key={question.id} className="panel editor-panel" aria-labelledby={`preview-question-${index}`}>
            <h2 id={`preview-question-${index}`}>Question {index + 1}</h2>
            <p>{question.question_text}</p>
            <ul className="quiz-preview-options">
              {question.options.map(option => (
                <li key={option.id} className="subpanel">
                  <span>{option.option_text}</span>
                  {option.is_correct && <strong className="status status-done">Bonne réponse</strong>}
                </li>
              ))}
            </ul>
            {question.explanation && <p className="editor-hint">Explication : {question.explanation}</p>}
          </section>
        ))}
      </div>
    </AdminLayout>
  );
}
