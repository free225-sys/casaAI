import { useEffect, useState } from "react";
import { AdminPagination, ADMIN_PAGE_SIZE } from "../../components/AdminPagination";
import { Link } from "../../components/AppLink";
import { EmptyState, PageHeader, Segmented, Status } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { AdminLayout } from "../../layouts/AdminLayout";
import { certificationService } from "../../services/certificationService";
import { formatDate as formatDateTime } from "../../utils/dates";
import type { CertificationListItem, CertificationRequest, CertificationRequestStatus } from "../../types/api";

type StateFilter = CertificationRequestStatus | "ALL";
const OPTIONS = [
  { value: "SUBMITTED", label: "À examiner" },
  { value: "APPROVED", label: "Approuvées" },
  { value: "REJECTED", label: "Refusées" },
  { value: "ALL", label: "Toutes" },
] as const;

/** File d'examen des demandes de certification officielle : réservée au SUPER_ADMIN (représentant CASA). Liste et total viennent du serveur. */
export function AdminCertificationRequestsPage() {
  const [state, setState] = useState<StateFilter>("SUBMITTED");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<CertificationRequest[] | null>(null);
  const [total, setTotal] = useState(0);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    certificationService.list().then(rows => { if (active) setTitles(Object.fromEntries((rows as CertificationListItem[]).map(row => [row.id, row.title]))); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setError(false); setItems(null);
    certificationService.adminListRequests({ state: state === "ALL" ? undefined : state, limit: ADMIN_PAGE_SIZE, offset: page * ADMIN_PAGE_SIZE })
      .then(result => {
        if (!active) return;
        const lastPage = Math.max(0, Math.ceil(result.total / ADMIN_PAGE_SIZE) - 1);
        if (page > lastPage) { setPage(lastPage); return; }
        setItems(result.items); setTotal(result.total);
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [state, page, reload]);

  return (
    <AdminLayout>
      <PageHeader title="Demandes de certification" description="Examen des demandes de certification officielle au nom de CASA Institut. Une décision est définitive et motivée." />
      <section className="panel admin-list" aria-label="Demandes de certification">
        <div className="admin-toolbar">
          <Segmented<StateFilter> label="Filtrer par état" value={state} options={OPTIONS} onChange={value => { setState(value); setPage(0); }} />
        </div>
        {error && <div role="alert" className="section-error" style={{ margin: "var(--space-4)" }}><p>Impossible de charger les demandes.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer les demandes</button></div>}
        {!error && items === null && <div style={{ padding: "var(--space-5)" }}><ListSkeleton count={4} /></div>}
        {!error && items !== null && items.length === 0 && <EmptyState title={state === "SUBMITTED" ? "Aucune demande à examiner" : "Aucune demande pour ce filtre"}>La file est vide : ce n’est pas une panne.</EmptyState>}
        {!error && items !== null && items.length > 0 && (
          <table className="admin-table">
            <thead><tr><th scope="col">Certification</th><th scope="col" className="col-status">État</th><th scope="col">Déposée le</th><th scope="col" className="col-actions"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><span className="admin-title">{titles[item.certification_id] ?? item.certification_id}</span><span className="admin-sub mono">Demandeur {item.user_id}</span></td>
                  <td className="col-status" data-label="État"><Status value={item.status} /></td>
                  <td className="admin-sub" data-label="Déposée le">{formatDateTime(item.submitted_at)}</td>
                  <td className="col-actions"><Link to={`/admin/certification-requests/${item.id}`} className="btn btn-secondary" aria-label={`Examiner la demande de ${titles[item.certification_id] ?? item.certification_id}`}>{item.status === "SUBMITTED" ? "Examiner" : "Consulter"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!error && items !== null && (
          <div className="admin-list-footer">
            <p className="admin-count" role="status">{items.length} demande(s) affichée(s) sur {total}.</p>
            <AdminPagination total={total} page={page} onPageChange={setPage} />
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
