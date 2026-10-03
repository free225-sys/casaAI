import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../components/AppLink";
import { RevealSection } from "../components/RevealSection";
import { MiniDiagram } from "../components/MiniDiagram";
import { Callout } from "../components/Callout";
import { LessonSkeleton } from "../components/Skeleton";
import { Notice, Status } from "../components/ui";
import { LessonDocumentView } from "../components/LessonDocumentView";
import { ApiError } from "../services/apiClient";
import { API_BASE_URL } from "../services/apiClient";
import { contentService } from "../services/contentService";
import { progressService } from "../services/progressService";
import type { CourseDetail, LessonDepthLevel, LessonDetail, LessonDocument } from "../types/api";

function resolveImageSrc(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
}


export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  // Keep reading and completion state specific to each route, including A → B → A.
  return <LessonContent key={lessonId} lessonId={lessonId} />;
}

function LessonContent({ lessonId }: { lessonId: string | undefined }) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [documentTree, setDocumentTree] = useState<LessonDocument | null>(null);
  const [activeDepth, setActiveDepth] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [focus, setFocus] = useState(false);
  const [savedProgress, setSavedProgress] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [syncReload, setSyncReload] = useState(0);
  const mounted = useRef(false);
  const latestSyncRequest = useRef(0);
  const completedRef = useRef(false);
  const persistedProgress = useRef(0);
  const pendingProgress = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    let timer: number | undefined;
    const startRequest = ++latestSyncRequest.current;
    setSyncError(null);
    const restore = (result: { status: string; progress_pct: number }) => {
      if (!active || completedRef.current) return;
      completedRef.current = result.status === "COMPLETED";
      setCompleted(completedRef.current);
      persistedProgress.current = Math.max(persistedProgress.current, result.progress_pct);
      setSavedProgress(persistedProgress.current);
      if (completedRef.current) setCompleteError(false);
    };
    const save = (pct: number) => {
      const saveRequest = ++latestSyncRequest.current;
      progressService.saveProgress(lessonId, pct).then(result => {
        restore(result);
        if (active && saveRequest === latestSyncRequest.current) setSyncError(null);
      }).catch(() => { if (active && saveRequest === latestSyncRequest.current && !completedRef.current) setSyncError("La progression n'a pas pu être enregistrée."); });
    };
    progressService.startLesson(lessonId).then(result => {
      restore(result);
      if (active && !completedRef.current && pendingProgress.current > persistedProgress.current) save(pendingProgress.current);
    }).catch(() => { if (active && startRequest === latestSyncRequest.current && !completedRef.current) setSyncError("Impossible de retrouver votre progression enregistrée."); });
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(window.scrollY / max * 100))) : 0;
      setReadingProgress(pct);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!active || completedRef.current || pct <= 0 || pct >= 100) return;
        pendingProgress.current = Math.max(pendingProgress.current, persistedProgress.current, pct);
        save(pendingProgress.current);
      }, 1500);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { active = false; window.removeEventListener("scroll", onScroll); window.clearTimeout(timer); };
  }, [lessonId, syncReload]);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    setLoadError(false);
    setNotFound(false);
    progressService
      .getLesson(lessonId)
      .then((data) => {
        if (!active) return;
        setLesson(data);
        if (data.depth_levels.length > 0) setActiveDepth(data.depth_levels[0].depth_key);
        // Fil d'Ariane : retrouver le cours parent pour répondre à
        // « où suis-je ? ». Best-effort — l'absence de titre de cours
        // n'empêche pas la lecture de la leçon.
        contentService.getCourse(data.course_id).then((value) => {
          if (active) setCourse(value);
        }).catch(() => {});
        // Structure documentaire, pour les seules leçons issues d'un import.
        // Best-effort là aussi : son absence ramène à l'affichage plat, qui
        // porte le même contenu.
        if (data.has_document) {
          progressService.getLessonDocument(lessonId).then((value) => {
            if (active) setDocumentTree(value);
          }).catch(() => {});
        }
      })
      .catch(error => { if (active) { setNotFound(error instanceof ApiError && error.status === 404); setLoadError(true); } });
    return () => { active = false; };
  }, [lessonId, reload]);

  const handleComplete = async () => {
    if (!lessonId || completing || completedRef.current) return;
    setCompleting(true);
    setCompleteError(false);
    try {
      const result = await progressService.completeLesson(lessonId);
      if (!mounted.current) return;
      setNextLessonId(result.next_lesson_id ?? null);
      completedRef.current = result.status === "COMPLETED";
      setCompleted(completedRef.current);
      persistedProgress.current = result.progress_pct;
      setSavedProgress(result.progress_pct);
      setSyncError(null);
    } catch { if (mounted.current && !completedRef.current) setCompleteError(true); }
    finally { if (mounted.current) setCompleting(false); }
  };

  const nextFromOutline = useMemo(() => {
    if (!course || !lessonId) return null;
    const ordered = [...course.lessons].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === lessonId);
    if (index < 0 || index >= ordered.length - 1) return null;
    return ordered[index + 1].id;
  }, [course, lessonId]);


  if (notFound) return <p className="error-text">Cette leçon est introuvable.</p>;
  if (loadError) return <div role="alert" className="section-error"><p>Impossible de charger cette leçon. Réessayez.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer le chargement</button></div>;
  if (!lesson) return <LessonSkeleton />;

  const activeLevel: LessonDepthLevel | undefined = lesson.depth_levels.find((d) => d.depth_key === activeDepth);

  return (
    <div className={`course-content${focus ? " is-focus" : ""}`}>
      <div className="reading-progress-track" role="progressbar" aria-label="Lecture de la page" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(readingProgress)}>
        <div className="reading-progress-fill" style={{ transform: `scaleX(${readingProgress / 100})` }} />
      </div>

      {course && (
        <Link
          to={`/courses/${course.id}`}
          style={{ display: "inline-block", fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: 14 }}
        >
          ← {course.title}
        </Link>
      )}

      <div className="lesson-layout">
      <div className="lesson-intro">
      <div className="lesson-meta">
        {savedProgress !== null && <Status value={completed ? "COMPLETED" : "IN_PROGRESS"} />}
        {lesson.level && <span className="text-caption">Niveau {lesson.level}</span>}
        {!!lesson.duration_min && <span className="text-caption">{lesson.duration_min} min</span>}
      </div>
      <h1 className="lesson-title">{lesson.title}</h1>
      {lesson.summary && (
        <p style={{ marginBottom: 24, fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--color-text)" }}>
          {lesson.summary}
        </p>
      )}

      </div>
      <aside className="lesson-toc" aria-label="Sommaire">
        <details open>
          <summary>Dans cette leçon</summary>
          <ol>{lesson.sections.map(section => <li key={section.position}><a href={`#section-${section.position}`}>{section.title}</a></li>)}</ol>
        </details>
        <button type="button" className="btn btn-secondary" aria-pressed={focus} onClick={() => setFocus(v => !v)}>{focus ? "Quitter le focus" : "Mode lecture"}</button>
        {course && <details className="course-outline">
          <summary>Plan du cours</summary><ol>{[...course.lessons].sort((a, b) => a.position - b.position).map(item => <li key={item.id}><Link to={`/app/lessons/${item.id}`} aria-current={item.id === lessonId ? "page" : undefined}>{item.title}</Link></li>)}</ol>
        </details>}
      </aside>
      <div className="lesson-main">
      {lesson.objectives.length > 0 && (
        <RevealSection as="div">
          <Callout kind="objective">
            <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {lesson.objectives.map((o, i) => (
                <li key={i} style={{ fontSize: "0.98rem" }}>
                  {o}
                </li>
              ))}
            </ul>
          </Callout>
        </RevealSection>
      )}

      {lesson.sections.map((section, i) => (
        <RevealSection
          key={section.position}
          as="section"
          delayMs={Math.min(i, 4) * 60}
          id={`section-${section.position}`}
          className="lesson-reading-section"
        >
          <span className="lesson-section-number">
            {String(i + 1).padStart(2, "0")} / {String(lesson.sections.length).padStart(2, "0")}
          </span>
          <h2 className="lesson-section-title">{section.title}</h2>
          {section.diagram && <MiniDiagram data={section.diagram} />}
          {section.image_url && (
            <figure style={{ margin: "0 0 16px" }}>
              <img
                src={resolveImageSrc(section.image_url)}
                alt={section.image_alt ?? ""}
                style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", display: "block" }}
              />
              {section.image_alt && <figcaption className="lesson-image-caption">{section.image_alt}</figcaption>}
            </figure>
          )}
          <p className="lesson-section-body">{section.body}</p>
        </RevealSection>
      ))}

      {/* Le document d'origine, consultable mais jamais à la place de la
          leçon : ce que l'apprenant lit est le travail éditorial publié, pas
          l'instantané figé de l'import. */}
      {documentTree && (
        <RevealSection as="div">
          <details className="card" style={{ padding: "18px 28px", marginBottom: 24 }}>
            <summary style={{ cursor: "pointer" }}>
              Document d'origine — {documentTree.source_file}
              <span style={{ opacity: 0.6, fontSize: "0.85rem" }}>
                {" "}({documentTree.page_count} page{documentTree.page_count > 1 ? "s" : ""})
              </span>
            </summary>
            <div style={{ marginTop: 18 }}>
              <LessonDocumentView sections={documentTree.sections} />
            </div>
          </details>
        </RevealSection>
      )}

      {lesson.depth_levels.length > 0 && (
        <RevealSection as="section" style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 14 }}>Approfondir</h2>
          <div
            role="tablist"
            aria-label="Angles de lecture"
            style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border)", marginBottom: 20, flexWrap: "wrap" }}
          >
            {lesson.depth_levels.map((d) => {
              const isActive = activeDepth === d.depth_key;

              return (
                <button
                  key={d.depth_key}
                  role="tab"
                  id={`depth-tab-${d.depth_key}`}
                  aria-controls={`depth-panel-${d.depth_key}`}
                  tabIndex={isActive ? 0 : -1}
                  aria-selected={isActive}
                  onClick={() => setActiveDepth(d.depth_key)}
                  onKeyDown={event => {
                    const keys = lesson.depth_levels.map(level => level.depth_key);
                    const index = keys.indexOf(d.depth_key);
                    const next = event.key === "ArrowRight" ? (index + 1) % keys.length : event.key === "ArrowLeft" ? (index + keys.length - 1) % keys.length : event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : -1;
                    if (next < 0) return;
                    event.preventDefault(); setActiveDepth(keys[next]); document.getElementById(`depth-tab-${keys[next]}`)?.focus();
                  }}
                  className={`depth-tab${isActive ? " active" : ""}`}

                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {activeLevel && (
            <div className="lesson-depth-content" role="tabpanel" id={`depth-panel-${activeDepth}`} aria-labelledby={`depth-tab-${activeDepth}`}>
              <h3 style={{ marginBottom: 12 }}>{activeLevel.title}</h3>
              <p className="lesson-section-body">{activeLevel.body}</p>
            </div>
          )}
        </RevealSection>
      )}

      {lesson.example && (
        <RevealSection as="section">
          <Callout kind="example">
            <p style={{ margin: 0 }}>{lesson.example}</p>
          </Callout>
        </RevealSection>
      )}

      <section className="lesson-finish" aria-label="Fin de la leçon">
      <h2>Fin de la leçon</h2>
      <p className="text-caption" role="status">{savedProgress === null ? "Progression en cours de synchronisation" : `Progression enregistrée : ${savedProgress} %`}</p>
      {syncError && !completed && <div role="alert" className="section-error"><p>{syncError}</p><button type="button" className="btn btn-secondary" onClick={() => setSyncReload(value => value + 1)}>Réessayer la synchronisation</button></div>}
      {completeError && <Notice>La leçon n'a pas pu être marquée comme terminée. Réessayez.</Notice>}
      <div className="lesson-actions">
      <button className="btn btn-primary" onClick={handleComplete} disabled={completing || completed}>
        {completed ? "Leçon terminée ✓" : completing ? "Enregistrement…" : "Marquer comme terminée"}
      </button>
      { (nextLessonId ?? nextFromOutline) && (
        <Link to={`/app/lessons/${nextLessonId ?? nextFromOutline}`} className="btn btn-secondary">
          Leçon suivante
        </Link>
      )}

      {lesson.validation_quiz_id && (
        <Link
          to={`/app/quizzes/${lesson.validation_quiz_id}`}
          className="btn btn-secondary"
        >
          Passer le quiz de validation
        </Link>
      )}
      </div>
      </section>
    </div>
      </div>
      </div>
  );
}
