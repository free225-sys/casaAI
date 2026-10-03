import { useEffect, useRef, useState } from "react";
import { Link } from "../components/AppLink";
import { useAuth } from "../stores/authStore";
import { ListSkeleton } from "../components/Skeleton";
import { AchievementBadges } from "../components/AchievementBadges";
import { progressService } from "../services/progressService";
import { useAsyncSection } from "../hooks/useAsyncSection";

function SectionError({ title, retry }: { title: string; retry: () => void }) {
  return <div className="section-error" role="alert">
    <p>Impossible de charger {title}. Vos données enregistrées sont conservées.</p>
    <button type="button" className="btn btn-secondary" onClick={retry}>Réessayer : {title}</button>
  </div>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const progress = useAsyncSection(progressService.getMyProgress);
  const skills = useAsyncSection(progressService.getMySkills);
  const badges = useAsyncSection(progressService.getMyBadges);
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

  return <div>
    <h1 style={{ fontSize: "1.8rem", marginBottom: 4 }}>Bonjour {user?.first_name}</h1>
    <p style={{ marginBottom: 16 }}>Voici où vous en êtes dans votre apprentissage.</p>
    {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && <div className="card" style={{ padding: 16, marginBottom: 24 }}>
      <p>Compte administrateur — l'espace apprenant reste ouvert pour prévisualiser.</p>
      <Link to="/admin/courses" className="btn btn-secondary">Ouvrir l'administration</Link>
    </div>}
    {resume && <div className="card" style={{ padding: 16, marginBottom: 24 }}>
      <p style={{ marginBottom: 8 }}>Reprendre : {resume.lesson_title}</p>
      <Link to={`/app/lessons/${resume.lesson_id}`} className="btn btn-primary">Continuer</Link>
    </div>}
    <section style={{ marginBottom: 32 }} aria-label="Badges">
      <h2>Badges</h2>
      {badges.error && <SectionError title="les badges" retry={badges.retry} />}
      {badges.loading && <p role="status">Chargement des badges…</p>}
      {!badges.loading && !badges.error && badges.data?.length === 0 && <p>Aucun badge pour le moment.</p>}
      {badges.data && <AchievementBadges badges={badges.data} />}
      {badges.data?.some(row => row.new) && <button type="button" className="btn btn-secondary" disabled={acknowledging} onClick={acknowledge}>
        {acknowledging ? "Enregistrement…" : "Marquer les nouveaux badges comme lus"}
      </button>}
      {ackError && <p role="alert" className="error-text">Impossible de marquer les badges comme lus. Réessayez avec le bouton ci-dessus.</p>}
    </section>
    <div className="dashboard-grid">
      <section aria-label="Progression">
        <h2>Progression {progress.data && <span className="text-caption">{completedCount} leçon{completedCount > 1 ? "s" : ""} terminée{completedCount > 1 ? "s" : ""}</span>}</h2>
        {progress.error && <SectionError title="la progression" retry={progress.retry} />}
        {progress.loading && <ListSkeleton count={3} />}
        {!progress.loading && !progress.error && progress.data?.length === 0 && <div className="card" style={{ padding: 24 }}>
          <p>Vous n'avez pas encore commencé de leçon. Direction le catalogue pour trouver votre premier cours.</p>
          <Link to="/catalog" className="btn btn-primary">Explorer le catalogue</Link>
        </div>}
        <div className="progress-list">
          {progress.data?.map(row => {
            const content = <><span className="badge">{row.status === "COMPLETED" ? "Terminée" : "En cours"}</span><span>{row.lesson_title}</span></>;
            return row.is_available === false
              ? <div key={row.lesson_id} className="card progress-row">{content}<span className="text-caption">Leçon indisponible — acquis conservés</span></div>
              : <Link key={row.lesson_id} to={`/app/lessons/${row.lesson_id}`} className="card progress-row">{content}</Link>;
          })}
        </div>
      </section>
      <section aria-label="Compétences">
        <h2>Compétences</h2>
        {skills.error && <SectionError title="les compétences" retry={skills.retry} />}
        {skills.loading && <ListSkeleton count={3} height={36} />}
        {!skills.loading && !skills.error && skills.data?.length === 0 && <p>Réussissez un quiz pour commencer à faire progresser vos compétences.</p>}
        <div className="progress-list">
          {skills.data?.map(row => <div key={row.skill_id}>
            <div className="skill-row"><span>{row.skill_name}</span><span>{row.mastery_level}/4</span>
              <Link to={`/app/skills/${row.skill_id}/practice`}>S'entraîner</Link>
            </div>
            <div className="skill-track" role="progressbar" aria-label={row.skill_name} aria-valuemin={0} aria-valuemax={4} aria-valuenow={row.mastery_level}>
              <div style={{ width: `${row.mastery_level / 4 * 100}%` }} />
            </div>
          </div>)}
        </div>
      </section>
    </div>
  </div>;
}
