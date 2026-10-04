import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { ConfirmDialog, Notice, PageHeader } from "../../components/ui";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import { adminRefusal } from "../../utils/adminErrors";
import type { AdminQuestionInput, ContentStatus, QuizKind } from "../../types/api";

const KIND_LABELS: Record<QuizKind, string> = {
  PRACTICE: "Entraînement (rattaché à une compétence)",
  VALIDATION: "Validation (rattaché à une leçon)",
  FINAL: "Final (rattaché à un cours)",
};

function emptyQuestion(): AdminQuestionInput {
  return { question_text: "", explanation: "", difficulty: 1, options: [{ option_text: "", is_correct: true }, { option_text: "", is_correct: false }] };
}

export function AdminQuizEditPage() {
  const params = useParams();
  return <AdminQuizEditPageContent key={JSON.stringify(params)} />;
}

function AdminQuizEditPageContent() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = quizId === "new";

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<QuizKind>((searchParams.get("kind") as QuizKind) || "PRACTICE");
  const [lessonId, setLessonId] = useState(searchParams.get("lesson_id") ?? "");
  const [courseId, setCourseId] = useState(searchParams.get("course_id") ?? "");
  const [skillId, setSkillId] = useState(searchParams.get("skill_id") ?? "");
  const [passThreshold, setPassThreshold] = useState(70);
  const [status, setStatus] = useState<ContentStatus>("DRAFT");
  const [questions, setQuestions] = useState<AdminQuestionInput[]>([]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const backTo = searchParams.get("back") || "/admin/courses";

  useEffect(() => {
    if (isNew || !quizId) return;
    let active = true;
    setLoading(true); setLoadError(false);
    adminService.getQuiz(quizId).then((q) => {
      if (!active) return;
      setTitle(q.title);
      setKind(q.kind);
      setLessonId(q.lesson_id ?? "");
      setCourseId(q.course_id ?? "");
      setSkillId(q.skill_id ?? "");
      setPassThreshold(q.pass_threshold);
      setStatus(q.status);
      setQuestions(
        q.questions.map((qq) => ({
          question_text: qq.question_text,
          explanation: qq.explanation,
          difficulty: qq.difficulty,
          options: qq.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
        })),
      );
      setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setLoadError(true); } });
    return () => { active = false; };
  }, [isNew, quizId, reload]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      title,
      kind,
      lesson_id: kind === "VALIDATION" ? lessonId || null : null,
      course_id: kind === "FINAL" ? courseId || null : null,
      skill_id: kind === "PRACTICE" ? skillId || null : null,
      pass_threshold: passThreshold,
      status,
      questions,
    };
    try {
      if (isNew) {
        await adminService.createQuiz(payload);
      } else if (quizId) {
        await adminService.updateQuiz(quizId, payload);
      }
      navigate(backTo);
    } catch (e) {
      setError(adminRefusal(e, "save", "L’enregistrement a échoué."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!quizId || isNew) return;
    setSaving(true);
    try {
      await adminService.deleteQuiz(quizId);
      navigate(backTo);
    } catch (e) {
      setConfirmDelete(false);
      setError(adminRefusal(e, "delete", "La suppression a échoué."));
      setSaving(false);
    }
  };

  const updateQuestion = (i: number, patch: Partial<AdminQuestionInput>) =>
    setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const setCorrectOption = (qi: number, oi: number) =>
    setQuestions(
      questions.map((q, j) =>
        j === qi ? { ...q, options: q.options.map((o, k) => ({ ...o, is_correct: k === oi })) } : q,
      ),
    );

  if (loadError) return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger cet éditeur. Aucun changement n’a été enregistré.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer le chargement</button></div></AdminLayout>;
  if (loading) return <AdminLayout><ListSkeleton count={5} height={44} /></AdminLayout>;

  return (
    <AdminLayout>
      <Link to={backTo} className="admin-back">← Retour</Link>
      <PageHeader title={isNew ? "Nouveau quiz" : "Modifier le quiz"} description="Les modifications ne sont enregistrées qu’avec le bouton « Enregistrer le quiz »." />
      {error && <Notice>{error}</Notice>}

      <div className="editor">
        <section className="panel editor-panel" aria-labelledby="quiz-general">
          <h2 id="quiz-general">Informations générales</h2>
          <div className="field">
            <label htmlFor="title">Titre</label>
            <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="kind">Type</label>
              <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as QuizKind)} disabled={!isNew}>
                {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pass">Seuil de réussite (%)</label>
              <input id="pass" type="number" min={0} max={100} value={passThreshold} onChange={(e) => setPassThreshold(Number(e.target.value))} />
            </div>
          </div>
          {kind === "VALIDATION" && (
            <div className="field">
              <label htmlFor="lesson_id">ID de la leçon</label>
              <input id="lesson_id" value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!isNew} />
            </div>
          )}
          {kind === "FINAL" && (
            <div className="field">
              <label htmlFor="course_id">ID du cours</label>
              <input id="course_id" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!isNew} />
            </div>
          )}
          {kind === "PRACTICE" && (
            <div className="field">
              <label htmlFor="skill_id">ID de la compétence</label>
              <input id="skill_id" value={skillId} onChange={(e) => setSkillId(e.target.value)} disabled={!isNew} />
            </div>
          )}
          <div className="field">
            <label htmlFor="status">Statut</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
            {status !== "PUBLISHED" && <p className="editor-hint">Un quiz non publié reste invisible pour les apprenants, même si un bouton y mène.</p>}
          </div>
        </section>

        <section className="panel editor-panel" aria-labelledby="quiz-questions">
          <h2 id="quiz-questions">Questions <span className="admin-count">({questions.length})</span></h2>
          {questions.map((q, qi) => (
            <fieldset key={qi} className="subpanel choice-group">
              <legend className="subpanel-head"><span>Question {qi + 1}</span></legend>
              <div className="field">
                <label htmlFor={`question-${qi}`}>Énoncé de la question {qi + 1}</label>
                <textarea id={`question-${qi}`} rows={2} value={q.question_text} onChange={(e) => updateQuestion(qi, { question_text: e.target.value })} />
              </div>
              <p className="editor-hint" id={`options-hint-${qi}`}>Options : sélectionnez la bonne réponse.</p>
              {q.options.map((opt, oi) => (
                <div key={oi} className="option-row">
                  <input type="radio" name={`correct-${qi}`} aria-label={`Bonne réponse : option ${oi + 1} de la question ${qi + 1}`} checked={opt.is_correct} onChange={() => setCorrectOption(qi, oi)} />
                  <input
                    className="input"
                    aria-label={`Texte de l’option ${oi + 1} de la question ${qi + 1}`}
                    value={opt.option_text}
                    placeholder={`Option ${oi + 1}`}
                    onChange={(e) => updateQuestion(qi, { options: q.options.map((o, k) => (k === oi ? { ...o, option_text: e.target.value } : o)) })}
                  />
                  {q.options.length > 2 && (
                    <button type="button" className="btn btn-secondary" aria-label={`Retirer l’option ${oi + 1} de la question ${qi + 1}`} onClick={() => updateQuestion(qi, { options: q.options.filter((_, k) => k !== oi) })}>Retirer</button>
                  )}
                </div>
              ))}
              <div><button type="button" className="btn btn-secondary" onClick={() => updateQuestion(qi, { options: [...q.options, { option_text: "", is_correct: false }] })}>Ajouter une option</button></div>
              <div className="field">
                <label htmlFor={`explanation-${qi}`}>Explication de la question {qi + 1} (optionnelle, affichée après réponse)</label>
                <input id={`explanation-${qi}`} value={q.explanation ?? ""} onChange={(e) => updateQuestion(qi, { explanation: e.target.value })} />
              </div>
              <div><button type="button" className="btn btn-quiet btn-text-danger" onClick={() => setQuestions(questions.filter((_, j) => j !== qi))}>Supprimer la question {qi + 1}</button></div>
            </fieldset>
          ))}
          <div><button type="button" className="btn btn-secondary" onClick={() => setQuestions([...questions, emptyQuestion()])}>Ajouter une question</button></div>
        </section>

        <div className="editor-actions">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !title}>
            {saving ? "Enregistrement…" : "Enregistrer le quiz"}
          </button>
          <Link to={backTo} className="btn btn-secondary">Annuler</Link>
          {!isNew && <button type="button" className="btn btn-danger spacer" onClick={() => setConfirmDelete(true)} disabled={saving}>Supprimer le quiz</button>}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog title="Supprimer ce quiz ?" confirmLabel="Supprimer le quiz" busy={saving} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)}>
          <p>Le quiz « {title || "sans titre"} » et ses {questions.length} question{questions.length > 1 ? "s" : ""} seront supprimés définitivement.</p>
        </ConfirmDialog>
      )}
    </AdminLayout>
  );
}
