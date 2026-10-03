import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { EmptyState } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import type { AdminLearnerProgressDetail } from "../../types/api";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Non commencée",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
};
const STATUS_KINDS: Record<string, string> = { NOT_STARTED: "draft", IN_PROGRESS: "progress", COMPLETED: "done" };

function Result({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`status ${ok ? "status-done" : "status-warning"}`}>{ok ? yes : no}</span>;
}

function DetailSection({ title, empty, count, head, children }: { title: string; empty: string; count: number; head: string[]; children: ReactNode }) {
  return (
    <section className="panel admin-list detail-section" aria-label={title}>
      <h2>{title}</h2>
      {count === 0 ? <EmptyState title={empty} /> : (
        <table className="admin-table">
          <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </section>
  );
}

export function AdminLearnerProgressDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [detail, setDetail] = useState<AdminLearnerProgressDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setError(null);
    setDetail(null);
    adminService
      .getLearnerProgressDetail(userId)
      .then((value) => { if (active) setDetail(value); })
      .catch(() => { if (active) setError("Impossible de charger la progression de cet apprenant."); });
    return () => { active = false; };
  }, [userId, reloadKey]);

  return (
    <AdminLayout>
      <Link to="/admin/progress" className="admin-back">← Retour à la liste</Link>

      {error && <div role="alert" className="section-error"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={() => setReloadKey((n) => n + 1)}>Réessayer</button></div>}

      {!detail ? (
        !error && <ListSkeleton count={4} height={44} />
      ) : (
        <>
          <div className="detail-head">
            <h1>{detail.first_name} {detail.last_name}</h1>
            <p>{detail.email}</p>
          </div>

          <DetailSection title="Leçons" empty="Aucune progression enregistrée." count={detail.lessons.length} head={["Leçon", "Avancement", "Statut", "Terminée le"]}>
            {detail.lessons.map((l) => (
              <tr key={l.lesson_id}>
                <td><span className="admin-title">{l.lesson_title}</span></td>
                <td className="metric">{l.progress_pct} %</td>
                <td className="col-status"><span className={`status status-${STATUS_KINDS[l.status] ?? "draft"}`}>{STATUS_LABELS[l.status] ?? l.status}</span></td>
                <td className="admin-sub">{formatDate(l.completed_at)}</td>
              </tr>
            ))}
          </DetailSection>

          <DetailSection title="Tentatives de quiz" empty="Aucune tentative enregistrée." count={detail.quiz_attempts.length} head={["Quiz", "Score", "Résultat", "Date"]}>
            {detail.quiz_attempts.map((q) => (
              <tr key={q.attempt_id}>
                <td><span className="admin-title">{q.quiz_title}</span></td>
                <td className="metric">{q.score} %</td>
                <td className="col-status"><Result ok={q.passed} yes="Réussi" no="Échoué" /></td>
                <td className="admin-sub">{formatDate(q.started_at)}</td>
              </tr>
            ))}
          </DetailSection>

          <DetailSection title="Labs" empty="Aucun résultat enregistré." count={detail.lab_results.length} head={["Lab", "Score", "Statut", "Soumis le"]}>
            {detail.lab_results.map((r) => (
              <tr key={r.result_id}>
                <td><span className="admin-title">{r.lab_title}</span></td>
                <td className="metric">{r.score !== null ? `${r.score} %` : "—"}</td>
                <td className="col-status"><span className={`status ${r.completed ? "status-done" : "status-progress"}`}>{r.completed ? "Terminé" : "En cours"}</span></td>
                <td className="admin-sub">{formatDate(r.submitted_at)}</td>
              </tr>
            ))}
          </DetailSection>
        </>
      )}
    </AdminLayout>
  );
}
