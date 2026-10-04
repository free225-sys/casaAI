import { useEffect, useState } from "react";
import { Link } from "../components/AppLink";
import { CertificationRequestView } from "../components/CertificationRequestView";
import { EmptyState, PageHeader } from "../components/ui";
import { ListSkeleton } from "../components/Skeleton";
import { certificationService } from "../services/certificationService";
import type { CertificationListItem, CertificationRequest } from "../types/api";
import { successorOf } from "../utils/certificationRequests";
import { formatDate } from "../utils/dates";
import { allPages } from "../utils/pagination";

/** Historique personnel des demandes de certification officielle, avec la décision de CASA le cas échéant. */
export function CertificationRequestsPage() {
  const [requests, setRequests] = useState<CertificationRequest[] | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false); setRequests(null);
    Promise.all([
      allPages(params => certificationService.listMyRequests(params), 100),
      certificationService.list().catch(() => [] as CertificationListItem[]),
    ]).then(([rows, certifications]) => {
      if (!active) return;
      setRequests(rows);
      setTitles(Object.fromEntries(certifications.map(item => [item.id, item.title])));
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [reload]);

  return (
    <div>
      <Link to="/app/certifications" className="admin-back">← Retour aux certifications</Link>
      <PageHeader title="Mes demandes de certification" description="Une certification est une validation officielle délivrée par CASA Institut. Chaque décision est définitive." />
      {error && <div role="alert" className="section-error"><p>Impossible de charger vos demandes.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer les demandes</button></div>}
      {!error && requests === null && <ListSkeleton count={3} />}
      {!error && requests !== null && requests.length === 0 && (
        <EmptyState title="Aucune demande" action={<Link to="/app/certifications" className="btn btn-primary">Voir les certifications</Link>}>
          Vous n’avez pas encore demandé de certification officielle.
        </EmptyState>
      )}
      {!error && requests !== null && requests.map(request => (
        <section key={request.id} className="panel request-section" aria-label={`Demande ${titles[request.certification_id] ?? request.certification_id}`}>
          <h2>{titles[request.certification_id] ?? request.certification_id}</h2>
          {request.previous_request_id && <p className="editor-hint">Dossier corrigé faisant suite au dossier refusé du {formatDate(requests.find(other => other.id === request.previous_request_id)?.submitted_at ?? request.submitted_at)}.</p>}
          {successorOf(request, requests) && <p className="editor-hint">Ce dossier a été suivi d’un dossier corrigé déposé le {formatDate(successorOf(request, requests)!.submitted_at)}.</p>}
          <CertificationRequestView request={request} certificationTitle={titles[request.certification_id]} />
        </section>
      ))}
    </div>
  );
}
