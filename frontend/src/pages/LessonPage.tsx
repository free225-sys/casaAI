import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../components/AppLink";
import { RevealSection } from "../components/RevealSection";
import { MiniDiagram } from "../components/MiniDiagram";
import { Callout } from "../components/Callout";
import { LessonSkeleton } from "../components/Skeleton";
import { LessonDocumentView } from "../components/LessonDocumentView";
import { ApiError } from "../services/apiClient";
import { API_BASE_URL } from "../services/apiClient";
import { contentService } from "../services/contentService";
import { progressService } from "../services/progressService";
import type { CourseDetail, LessonDepthLevel, LessonDetail, LessonDocument } from "../types/api";

function resolveImageSrc(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
}

/** Couleurs d'accent cycliques (or / teal / corail) pour distinguer les
 * niveaux de profondeur (Essentiel, Technique, Maths, Implémentation,
 * Architecture, Gouvernance) d'un coup d'œil, sans dépendre uniquement du
 * libellé texte. */
const DEPTH_ACCENTS = ["var(--color-accent-blue)", "var(--color-accent-gold)", "var(--color-accent-teal)"];

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
    } catch { if (mounted.current) setCompleteError(true); }
    finally { if (mounted.current) setCompleting(false); }
  };

  const nextFromOutline = useMemo(() => {
    if (!course || !lessonId) return null;
    const ordered = [...course.lessons].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === lessonId);
    if (index < 0 || index >= ordered.length - 1) return null;
    return ordered[index + 1].id;
  }, [course, lessonId]);

  const depthAccentByKey = useMemo(() => {
    if (!lesson) return {};
    const map: Record<string, string> = {};
    lesson.depth_levels.forEach((d, i) => {
      map[d.depth_key] = DEPTH_ACCENTS[i % DEPTH_ACCENTS.length];
    });
    return map;
  }, [lesson]);

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

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button type="button" className="btn btn-secondary" onClick={() => setFocus((v) => !v)}>
          {focus ? "Quitter le focus" : "Mode lecture"}
        </button>
        {lesson.level && <span className="badge badge-teal">{lesson.level}</span>}
        {lesson.duration_min && <span className="badge badge-gold">{lesson.duration_min} min</span>}
      </div>
      <div className="lesson-layout">
      <aside className="lesson-toc" aria-label="Sommaire">
        <p className="text-caption">Sommaire</p>
        <ol>
          {lesson.sections.map((section) => (
            <li key={section.position}>
              <a href={`#section-${section.position}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </aside>
      <div>
      <h1 style={{ marginBottom: 16 }}>{lesson.title}</h1>
      {lesson.summary && (
        <p style={{ marginBottom: 24, fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--color-text)" }}>
          {lesson.summary}
        </p>
      )}

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
          className="card"
          style={{ padding: 28, marginBottom: 24 }}
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
            style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border)", marginBottom: 20, flexWrap: "wrap" }}
          >
            {lesson.depth_levels.map((d) => {
              const isActive = activeDepth === d.depth_key;
              const accent = depthAccentByKey[d.depth_key];
              return (
                <button
                  key={d.depth_key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveDepth(d.depth_key)}
                  className={`depth-tab${isActive ? " active" : ""}`}
                  style={{ borderBottomColor: isActive ? accent : "transparent", color: isActive ? accent : undefined }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {activeLevel && (
            <div className="card" style={{ padding: 24 }}>
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

      <p className="text-caption" role="status">{savedProgress === null ? "Progression en cours de synchronisation" : `Progression enregistrée : ${savedProgress} %`}</p>
      {syncError && !completed && <div role="alert" className="section-error"><p>{syncError}</p><button type="button" className="btn btn-secondary" onClick={() => setSyncReload(value => value + 1)}>Réessayer la synchronisation</button></div>}
      {completeError && <p role="alert" className="error-text">La leçon n'a pas pu être marquée comme terminée. Réessayez.</p>}
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
    </div>
      </div>
      </div>
  );
}
