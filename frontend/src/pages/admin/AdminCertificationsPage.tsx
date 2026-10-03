import { useEffect, useState } from "react";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { EmptyState, PageHeader } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import type { AdminCertificationListItem } from "../../types/api";

export function AdminCertificationsPage() {
  const [items, setItems] = useState<AdminCertificationListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    adminService.listCertifications()
      .then((r) => { if (active) setItems(r.items); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [reloadKey]);

  return (
    <AdminLayout>
      <PageHeader
        title="Certifications"
        description="Reliez chaque critère à une compétence, un cours ou un lab pour que l’éligibilité soit vérifiée automatiquement à partir des quiz et de la progression réelle des apprenants."
      />

      {error && <div role="alert" className="section-error"><p>Impossible de charger les certifications.</p><button type="button" className="btn btn-secondary" onClick={() => setReloadKey((n) => n + 1)}>Réessayer les certifications</button></div>}

      {!error && (
        <section className="panel admin-list" aria-label="Liste des certifications">
          {items === null ? (
            <div style={{ padding: "var(--space-5)" }}><ListSkeleton count={4} /></div>
          ) : items.length === 0 ? (
            <EmptyState title="Aucune certification" />
          ) : (
            <table className="admin-table">
              <thead><tr><th scope="col">Certification</th><th scope="col" className="col-status">Critères reliés</th><th scope="col" className="col-actions">Action</th></tr></thead>
              <tbody>
                {items.map((c) => {
                  const complete = c.linked_requirement_count === c.requirement_count;
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="admin-title">{c.title}</span>
                        {c.level && <span className="admin-sub">{c.level}</span>}
                      </td>
                      <td className="col-status">
                        <span className={`status ${complete ? "status-done" : "status-warning"}`}>
                          {c.linked_requirement_count}/{c.requirement_count} critères reliés{complete ? "" : " : à compléter"}
                        </span>
                      </td>
                      <td className="col-actions"><Link to={`/admin/certifications/${c.id}`} className="btn btn-secondary">Gérer les critères de {c.title}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </AdminLayout>
  );
}
