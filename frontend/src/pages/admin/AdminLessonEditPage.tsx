import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { LessonNotionsSection } from "../../components/LessonNotionsSection";
import { SectionImageField } from "../../components/SectionImageField";
import { Notice, PageHeader } from "../../components/ui";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import { adminRefusal } from "../../utils/adminErrors";
import type { AdminLessonDepthLevelInput, AdminLessonSectionInput } from "../../types/api";

const DEPTH_KEYS = ["ESSENTIAL", "TECHNICAL", "MATHEMATICS", "IMPLEMENTATION", "ARCHITECTURE", "GOVERNANCE"] as const;
const DEPTH_LABELS: Record<(typeof DEPTH_KEYS)[number], string> = {
  ESSENTIAL: "Essentiel", TECHNICAL: "Technique", MATHEMATICS: "Mathématiques",
  IMPLEMENTATION: "Implémentation", ARCHITECTURE: "Architecture", GOVERNANCE: "Gouvernance",
};

export function AdminLessonEditPage() {
  const params = useParams();
  return <AdminLessonEditPageContent key={JSON.stringify(params)} />;
}

function AdminLessonEditPageContent() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = (location.state as { lessonCreated?: boolean } | null)?.lessonCreated === true;
  const isNew = lessonId === "new";
  const [notionsDirty, setNotionsDirty] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [summary, setSummary] = useState("");
  const [example, setExample] = useState("");
  const [position, setPosition] = useState(0);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [sections, setSections] = useState<AdminLessonSectionInput[]>([]);
  const [depthLevels, setDepthLevels] = useState<AdminLessonDepthLevelInput[]>([]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationQuizId, setValidationQuizId] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !lessonId) return;
    let active = true;
    setLoading(true); setLoadError(false);
    adminService.getLesson(lessonId).then((l) => {
      if (!active) return;
      setTitle(l.title);
      setLevel(l.level ?? "");
      setDurationMin(l.duration_min ? String(l.duration_min) : "");
      setSummary(l.summary ?? "");
      setExample(l.example ?? "");
      setPosition(l.position);
      setStatus(l.status);
      setObjectives(l.objectives);
      setSections(l.sections);
      setDepthLevels(l.depth_levels);
      setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setLoadError(true); } });
    adminService.listQuizzes({ lessonId }).then((res) => {
      if (active) setValidationQuizId(res.items[0]?.id ?? null);
    }).catch(() => { if (active) { setLoading(false); setLoadError(true); } });
    return () => { active = false; };
  }, [isNew, lessonId, reload]);

  const handleSave = async () => {
    if (!courseId) return;
    setSaving(true);
    setError(null);
    const payload = {
      course_id: courseId,
      title,
      level: level || null,
      duration_min: durationMin ? Number(durationMin) : null,
      summary: summary || null,
      example: example || null,
      position,
      status,
      objectives,
      sections,
      depth_levels: depthLevels,
    };
    try {
      if (isNew) {
        // Rester sur l'éditeur de la leçon créée (route remplacée par l'identifiant renvoyé) : les notions s'enregistrent ensuite séparément,
        // sans jamais recréer la leçon en cas de panne.
        const created = await adminService.createLesson(payload);
        navigate(`/admin/courses/${courseId}/lessons/${encodeURIComponent(created.id)}`, { replace: true, state: { lessonCreated: true } });
        return;
      } else if (lessonId) {
        await adminService.updateLesson(lessonId, payload);
        if (notionsDirty) {
          // Les notions ne sont pas encore enregistrées : on reste sur la page pour ne pas perdre la sélection.
          setSavedNotice("Leçon enregistrée. Les notions ne sont pas encore enregistrées : utilisez « Enregistrer les notions ».");
          return;
        }
      }
      navigate(`/admin/courses/${courseId}`);
    } catch (e) {
      setError(adminRefusal(e, "save", "L’enregistrement a échoué."));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger cet éditeur. Aucun changement n’a été enregistré.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer le chargement</button></div></AdminLayout>;
  if (loading) return <AdminLayout><ListSkeleton count={5} height={44} /></AdminLayout>;

  const backTo = `/admin/courses/${courseId}`;
  const quizBack = lessonId ? encodeURIComponent(`/admin/courses/${courseId}/lessons/${lessonId}`) : "";

  return (
    <AdminLayout>
      <Link to={backTo} className="admin-back">← Retour aux leçons</Link>
      <PageHeader
        title={isNew ? "Nouvelle leçon" : "Modifier la leçon"}
        description="Les modifications ne sont enregistrées qu’avec le bouton « Enregistrer la leçon »."
        actions={!isNew && lessonId ? <Link to={`/admin/preview/lessons/${lessonId}`} className="btn btn-secondary">Aperçu de la leçon</Link> : undefined}
      />
      {error && <Notice>{error}</Notice>}
      {justCreated && !savedNotice && <Notice kind="success">Leçon créée. Vous pouvez maintenant lui associer des notions.</Notice>}
      {savedNotice && <Notice kind="success">{savedNotice}</Notice>}

      <div className="editor">
        <section className="panel editor-panel" aria-labelledby="lesson-general">
          <h2 id="lesson-general">Informations générales</h2>
          <div className="field">
            <label htmlFor="title">Titre</label>
            <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="level">Niveau</label>
              <input id="level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="ex : N2" />
            </div>
            <div className="field">
              <label htmlFor="duration">Durée (min)</label>
              <input id="duration" type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="position">Position</label>
              <input id="position" type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="summary">Résumé</label>
            <input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="example">Exemple</label>
            <input id="example" value={example} onChange={(e) => setExample(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="status">Statut</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
            {status !== "PUBLISHED" && <p className="editor-hint">Une leçon non publiée reste invisible des apprenants.</p>}
          </div>
        </section>

        <section className="panel editor-panel" aria-labelledby="lesson-objectives">
          <h2 id="lesson-objectives">Objectifs <span className="admin-count">({objectives.length})</span></h2>
          {objectives.map((obj, i) => (
            <div key={i} className="option-row">
              <input
                className="input"
                aria-label={`Objectif ${i + 1}`}
                value={obj}
                onChange={(e) => setObjectives(objectives.map((o, j) => (j === i ? e.target.value : o)))}
              />
              <button type="button" className="btn btn-secondary" aria-label={`Retirer l’objectif ${i + 1}`} onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}>Retirer</button>
            </div>
          ))}
          <div><button type="button" className="btn btn-secondary" onClick={() => setObjectives([...objectives, ""])}>Ajouter un objectif</button></div>
        </section>

        <section className="panel editor-panel" aria-labelledby="lesson-sections">
          <h2 id="lesson-sections">Sections <span className="admin-count">({sections.length})</span></h2>
          {sections.map((sec, i) => (
            <div key={i} className="subpanel">
              <div className="subpanel-head">
                <h3>Section {i + 1}</h3>
                <button type="button" className="btn btn-quiet btn-text-danger" onClick={() => setSections(sections.filter((_, j) => j !== i))}>Supprimer la section {i + 1}</button>
              </div>
              <div className="field">
                <label htmlFor={`section-title-${i}`}>Titre de la section {i + 1}</label>
                <input id={`section-title-${i}`} value={sec.title} onChange={(e) => setSections(sections.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))} />
              </div>
              <div className="field">
                <label htmlFor={`section-body-${i}`}>Contenu de la section {i + 1}</label>
                <textarea id={`section-body-${i}`} rows={4} value={sec.body} onChange={(e) => setSections(sections.map((s, j) => (j === i ? { ...s, body: e.target.value } : s)))} />
              </div>
              <SectionImageField
              courseId={courseId ?? ""}
                imageUrl={sec.image_url}
                imageAlt={sec.image_alt}
                onChange={(imageUrl, imageAlt) =>
                  setSections(sections.map((s, j) => (j === i ? { ...s, image_url: imageUrl, image_alt: imageAlt } : s)))
                }
              />
            </div>
          ))}
          <div><button type="button" className="btn btn-secondary" onClick={() => setSections([...sections, { title: "", body: "" }])}>Ajouter une section</button></div>
        </section>

        <section className="panel editor-panel" aria-labelledby="lesson-depth">
          <h2 id="lesson-depth">Niveaux de profondeur <span className="admin-count">({depthLevels.length})</span></h2>
          <p className="editor-hint">Jusqu’à six niveaux : Essentiel, Technique, Mathématiques, Implémentation, Architecture, Gouvernance.</p>
          {depthLevels.map((dl, i) => (
            <div key={i} className="subpanel">
              <div className="subpanel-head">
                <h3>Niveau {i + 1}</h3>
                <button type="button" className="btn btn-quiet btn-text-danger" onClick={() => setDepthLevels(depthLevels.filter((_, j) => j !== i))}>Supprimer le niveau {i + 1}</button>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor={`depth-key-${i}`}>Type du niveau {i + 1}</label>
                  <select id={`depth-key-${i}`} value={dl.depth_key} onChange={(e) => setDepthLevels(depthLevels.map((d, j) => (j === i ? { ...d, depth_key: e.target.value as typeof d.depth_key } : d)))}>
                    {DEPTH_KEYS.map((k) => <option key={k} value={k}>{DEPTH_LABELS[k]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`depth-label-${i}`}>Libellé du niveau {i + 1}</label>
                  <input id={`depth-label-${i}`} placeholder="ex : Essentiel" value={dl.label} onChange={(e) => setDepthLevels(depthLevels.map((d, j) => (j === i ? { ...d, label: e.target.value } : d)))} />
                </div>
              </div>
              <div className="field">
                <label htmlFor={`depth-title-${i}`}>Titre du niveau {i + 1}</label>
                <input id={`depth-title-${i}`} value={dl.title} onChange={(e) => setDepthLevels(depthLevels.map((d, j) => (j === i ? { ...d, title: e.target.value } : d)))} />
              </div>
              <div className="field">
                <label htmlFor={`depth-body-${i}`}>Contenu du niveau {i + 1}</label>
                <textarea id={`depth-body-${i}`} rows={4} value={dl.body} onChange={(e) => setDepthLevels(depthLevels.map((d, j) => (j === i ? { ...d, body: e.target.value } : d)))} />
              </div>
            </div>
          ))}
          <div><button type="button" className="btn btn-secondary" onClick={() => setDepthLevels([...depthLevels, { depth_key: "ESSENTIAL", label: "", title: "", body: "" }])}>Ajouter un niveau</button></div>
        </section>

        {!isNew && lessonId && courseId && (
          <section className="panel quiz-link" aria-labelledby="lesson-quiz">
            <div>
              <h2 id="lesson-quiz" style={{ fontSize: "1rem" }}>Quiz de validation</h2>
              <p className="editor-hint">{validationQuizId ? "Cette leçon a déjà un quiz de validation." : "Aucun quiz de validation pour l’instant."}</p>
            </div>
            <span className="ui-row">
              {validationQuizId && <Link to={`/admin/preview/quizzes/${validationQuizId}`} className="btn btn-secondary">Aperçu du quiz</Link>}
              <Link
                to={validationQuizId ? `/admin/quizzes/${validationQuizId}?back=${quizBack}` : `/admin/quizzes/new?kind=VALIDATION&lesson_id=${lessonId}&back=${quizBack}`}
                className="btn btn-secondary"
              >
                {validationQuizId ? "Gérer le quiz" : "Créer un quiz"}
              </Link>
            </span>
          </section>
        )}

        <LessonNotionsSection lessonId={isNew ? undefined : lessonId} onDirtyChange={setNotionsDirty} />

        <div className="editor-actions">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !title}>
            {saving ? "Enregistrement…" : "Enregistrer la leçon"}
          </button>
          <Link to={backTo} className="btn btn-secondary">Annuler</Link>
        </div>
      </div>
    </AdminLayout>
  );
}
