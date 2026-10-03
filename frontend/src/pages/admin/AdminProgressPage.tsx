import { useEffect, useState } from "react";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { EmptyState, PageHeader } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import type { AdminLearnerProgressSummary } from "../../types/api";

const LIMIT = 50;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function AdminProgressPage() {
  const [rows, setRows] = useState<AdminLearnerProgressSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    adminService
      .listLearnerProgress({ search: search || undefined, limit: LIMIT })
      .then((page) => {
        if (!active) return;
        setRows(page.items);
        setTotal(page.total);
      })
      .catch(() => { if (active) { setRows(null); setError("Impossible de charger la progression des apprenants."); } });
    return () => { active = false; };
  }, [search, reloadKey]);

  return (
    <AdminLayout>
      <PageHeader title="Progression" description="Avancement des apprenants : leçons, quiz et labs." />

      {error && <div role="alert" className="section-error"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={() => setReloadKey((n) => n + 1)}>Réessayer la progression</button></div>}

      <section className="panel admin-list" aria-label="Progression des apprenants">
        <div className="admin-toolbar">
          <input className="input" type="search" aria-label="Rechercher un apprenant" placeholder="Nom ou email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {error ? null : rows === null ? (
          <div style={{ padding: "var(--space-5)" }}><ListSkeleton count={5} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Aucun apprenant trouvé">{search ? "Aucun apprenant ne correspond à cette recherche." : "Aucun apprenant n’est encore inscrit."}</EmptyState>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr><th scope="col">Apprenant</th><th scope="col">Leçons</th><th scope="col">Quiz</th><th scope="col">Score moyen</th><th scope="col">Labs</th><th scope="col">Dernière activité</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td>
                      <Link to={`/admin/progress/${r.user_id}`} className="admin-row-link">
                        <span className="admin-title">{r.first_name} {r.last_name}</span>
                        <span className="admin-sub">{r.email}</span>
                      </Link>
                    </td>
                    <td className="metric" data-label="Leçons">{r.lessons_completed} / {r.lessons_total_published} leçons</td>
                    <td className="metric" data-label="Quiz">{r.quizzes_passed} / {r.quizzes_attempted} quiz réussis</td>
                    <td className="metric" data-label="Score moyen">{r.quiz_average_score !== null ? `${Math.round(r.quiz_average_score)} % de moyenne` : "Pas de score"}</td>
                    <td className="metric" data-label="Labs">{r.labs_completed} lab{r.labs_completed > 1 ? "s" : ""}</td>
                    <td className="admin-sub" data-label="Dernière activité">{formatDate(r.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="admin-list-footer">
              <p className="admin-count" role="status">
                {rows.length} apprenant{rows.length > 1 ? "s" : ""} affiché{rows.length > 1 ? "s" : ""} sur {total}
                {total > rows.length ? ` · seuls les ${LIMIT} premiers sont chargés : affinez la recherche pour trouver les autres.` : ""}
              </p>
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
