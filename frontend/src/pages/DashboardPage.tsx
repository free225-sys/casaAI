import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "../components/AppLink";
import { useAuth } from "../stores/authStore";
import { ListSkeleton } from "../components/Skeleton";
import { AchievementBadges } from "../components/AchievementBadges";
import { progressService } from "../services/progressService";
import { contentService } from "../services/contentService";
import type { CourseDetail } from "../types/api";
import { EmptyState, Notice, PageHeader, Status } from "../components/ui";
import { useAsyncSection } from "../hooks/useAsyncSection";
import { RETURN_NOTICE_TEXT, type ReturnNotice } from "../utils/returnCourse";

function SectionError({ title, retry }: { title: string; retry: () => void }) {
  return <div className="section-error" role="alert">
    <p>Impossible de charger {title}. Vos données enregistrées sont conservées.</p>
    <button type="button" className="btn btn-secondary" onClick={retry}>Réessayer : {title}</button>
  </div>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const returnNotice = (useLocation().state as { returnNotice?: ReturnNotice } | null)?.returnNotice;
  const progress = useAsyncSection(progressService.getMyProgress);
  const skills = useAsyncSection(progressService.getMySkills);
  const badges = useAsyncSection(progressService.getMyBadges);
  const [courses, setCourses] = useState<Record<string, CourseDetail>>({});
  useEffect(() => {
    let active = true;
    const ids = [...new Set(progress.data?.filter(row => row.is_available !== false).map(row => row.course_id) ?? [])];
    Promise.allSettled(ids.map(id => contentService.getCourse(id))).then(results => {
      if (!active) return;
      const known: Record<string, CourseDetail> = {};
      results.forEach((result, index) => { if (result.status === "fulfilled") known[ids[index]] = result.value; });
      setCourses(known);
    });
    return () => { active = false; };
  }, [progress.data]);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackError, setAckError] = useState(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Refresh the bell after badge calculation; reading the dashboard never acknowledges.
  useEffect(() => { if (badges.data) window.dispatchEvent(new Event("badges-updated")); }, [badges.data]);
  const acknowledge = async () => {
    if (acknowledging) return;
    setAcknowledging(true); setAckError(false);
    try {
      await progressService.acknowledgeBadges();
      if (!mounted.current) return;
      badges.setData(rows => rows?.map(row => ({ ...row, new: false })) ?? null);
      window.dispatchEvent(new Event("badges-updated"));
    } catch { if (mounted.current) setAckError(true); }
    finally { if (mounted.current) setAcknowledging(false); }
  };
  const available = progress.data?.filter(row => row.is_available !== false) ?? [];
  const resume = available.find(row => row.status === "IN_PROGRESS") ?? available.find(row => row.status !== "COMPLETED");
  const completedCount = progress.data?.filter(row => row.status === "COMPLETED").length ?? 0;

  const groups = [...new Set(progress.data?.map(row => row.course_id) ?? [])];
  const metric = (value: number | undefined, label: string) => <div className="card dashboard-metric"><strong>{value ?? "—"}</strong><span>{label}</span></div>;
  return <div className="dashboard">
    <PageHeader title={`Bonjour ${user?.first_name ?? ""}`} description="Reprenez là où vous vous êtes arrêté." />
    {returnNotice && returnNotice in RETURN_NOTICE_TEXT && <Notice kind="info"><p>{RETURN_NOTICE_TEXT[returnNotice]}</p><Link to="/catalog" className="btn btn-secondary">Voir le catalogue</Link></Notice>}
    {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && <Notice kind="info"><p>Compte administrateur — l'espace apprenant reste ouvert pour prévisualiser.</p><Link to="/admin/courses" className="btn btn-secondary">Ouvrir l'administration</Link></Notice>}
    {badges.data?.some(row => row.new) && <Notice kind="success"><p><strong>Nouveaux badges :</strong> {badges.data.filter(row => row.new).map(row => row.title).join(", ")}</p><button type="button" className="btn btn-secondary" disabled={acknowledging} onClick={acknowledge}>{acknowledging ? "Enregistrement…" : "Marquer les nouveaux badges comme lus"}</button></Notice>}
    {ackError && <Notice>Impossible de marquer les badges comme lus. Réessayez avec le bouton ci-dessus.</Notice>}
    {resume && <section className="panel dashboard-resume" aria-label="Reprendre">
      <div><p className="text-label">Reprendre</p><h2>{resume.lesson_title}</h2>{courses[resume.course_id] && <p>{courses[resume.course_id].title}</p>}
      <p className="text-caption">Progression enregistrée : {resume.progress_pct} %</p><div className="skill-track" role="progressbar" aria-label="Progression de la leçon à reprendre" aria-valuemin={0} aria-valuemax={100} aria-valuenow={resume.progress_pct}><div style={{width: `${resume.progress_pct}%`}} /></div></div>
      <Link to={`/app/lessons/${resume.lesson_id}`} className="btn btn-primary">Continuer</Link>
    </section>}
    <div className="dashboard-metrics" aria-label="Synthèse">
      {metric(progress.data ? completedCount : undefined, "leçons terminées")}
      {metric(progress.data?.filter(row => row.status === "IN_PROGRESS").length, "leçons en cours")}
      {metric(badges.data?.filter(row => row.earned).length, "badges obtenus")}
      {metric(skills.data?.length, "compétences suivies")}
    </div>
    <div className="dashboard-grid">
      <section className="panel" aria-label="Progression">
        <div className="page-header"><h2>Mes cours</h2><Link to="/catalog">Catalogue →</Link></div>
        {progress.error && <SectionError title="la progression" retry={progress.retry} />}
        {progress.loading && <ListSkeleton count={3} />}
        {!progress.loading && !progress.error && progress.data?.length === 0 && <EmptyState title="Votre première leçon vous attend" action={<Link to="/catalog" className="btn btn-primary">Explorer le catalogue</Link>}>Vous n'avez pas encore commencé de leçon. Direction le catalogue pour trouver votre premier cours.</EmptyState>}
        {groups.map(id => {
          const rows = progress.data?.filter(row => row.course_id === id) ?? [];
          const course = courses[id];
          return <div key={id} className="dashboard-course"><h3>{course?.title ?? "Historique de cours"}</h3>
            <p className="text-caption">{rows.filter(row => row.status === "COMPLETED").length} leçon(s) terminée(s){course ? ` · ${course.lessons.length} leçon(s) actuellement disponibles dans le cours` : ""}</p>
            <div className="progress-list">{rows.map(row => {
              const content = <><Status value={row.status} /><span className="progress-title">{row.lesson_title}</span></>;
              return row.is_available === false
                ? <div key={row.lesson_id} className="progress-row is-unavailable">{content}<span className="text-caption">Leçon indisponible — acquis conservés</span></div>
                : <Link key={row.lesson_id} to={`/app/lessons/${row.lesson_id}`} className="progress-row">{content}<span className="text-caption">{row.progress_pct} %</span></Link>;
            })}</div>
          </div>;
        })}
      </section>
      <div className="dashboard-side">
        <section className="panel" aria-label="Compétences">
          <h2>Compétences</h2><p className="text-caption">Niveau de maîtrise, de 0 à 4.</p>
          {skills.error && <SectionError title="les compétences" retry={skills.retry} />}
          {skills.loading && <ListSkeleton count={3} height={36} />}
          {!skills.loading && !skills.error && skills.data?.length === 0 && <p>Réussissez un quiz pour commencer à faire progresser vos compétences.</p>}
          <div className="progress-list">{skills.data?.map(row => <div key={row.skill_id}>
            <div className="skill-row"><span>{row.skill_name}</span><span>{row.mastery_level}/4</span><Link to={`/app/skills/${row.skill_id}/practice`}>S'entraîner</Link></div>
            <div className="skill-track" role="progressbar" aria-label={row.skill_name} aria-valuemin={0} aria-valuemax={4} aria-valuenow={row.mastery_level}><div style={{width: `${row.mastery_level / 4 * 100}%`}} /></div>
          </div>)}</div>
        </section>
        <section className="panel" aria-label="Badges">
          <h2>Badges</h2>
          {badges.error && <SectionError title="les badges" retry={badges.retry} />}
          {badges.loading && <p role="status">Chargement des badges…</p>}
          {!badges.loading && !badges.error && badges.data?.length === 0 && <p>Aucun badge pour le moment.</p>}
          {badges.data && <AchievementBadges badges={badges.data} />}
        </section>
      </div>
    </div>
  </div>;
}
