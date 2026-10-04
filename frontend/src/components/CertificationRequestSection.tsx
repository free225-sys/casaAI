import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "./AppLink";
import { CertificationRequestView } from "./CertificationRequestView";
import { Notice } from "./ui";
import { ApiError } from "../services/apiClient";
import { certificationService } from "../services/certificationService";
import { portfolioService } from "../services/portfolioService";
import type { CertificationRequest, PortfolioEvidence } from "../types/api";
import { formatDate } from "../utils/dates";
import { currentRequest } from "../utils/certificationRequests";
import { allPages } from "../utils/pagination";

const MAX_STATEMENT = 10000;

interface FormProps {
  certificationId: string;
  previous: CertificationRequest | null;
  evidences: PortfolioEvidence[];
  onCreated: (request: CertificationRequest) => void;
  onConflict: () => void;
}

/** Premier dépôt (sans lien) ou dossier corrigé après refus (avec `previous_request_id`). Une panne se rejoue avec la même saisie : le serveur
 * est idempotent pour un même lien et un même contenu ; on ne change jamais de lien en cours de retry. */
function RequestForm({ certificationId, previous, evidences, onCreated, onConflict }: FormProps) {
  const [statement, setStatement] = useState(previous?.statement ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set((previous?.evidence_ids ?? []).filter(id => evidences.some(evidence => evidence.id === id))));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !statement.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const created = await certificationService.submitRequest({
        certification_id: certificationId,
        evidence_ids: [...selected],
        statement: statement.trim(),
        ...(previous ? { previous_request_id: previous.id } : {}),
      });
      onCreated(created);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(`Dépôt refusé par le serveur : ${e.detail || "un autre dossier est déjà en cours, ou rien n’a été corrigé par rapport au refus."} Aucun dossier n’a été créé ni remplacé. Corrigez la déclaration, la sélection ou le contenu des preuves, ou actualisez la page.`);
        onConflict();
      } else if (e instanceof ApiError && e.status === 404) setError("Une des preuves sélectionnées ou le dossier précédent est introuvable : actualisez la page et vérifiez votre saisie.");
      else if (e instanceof ApiError && e.status === 403) setError("Seul un compte apprenant peut déposer une demande de certification.");
      else if (e instanceof ApiError && e.status === 422) setError(`Demande refusée par le serveur : ${e.detail || "vérifiez la déclaration et les preuves."}`);
      else setError("La demande n’a pas pu être envoyée. Votre saisie est conservée : vous pouvez réessayer sans risque de doublon.");
    } finally {
      setSubmitting(false);
    }
  };

  const correcting = previous !== null;
  return (
    <form onSubmit={submit} className="admin-form" aria-label={correcting ? "Dossier corrigé" : "Nouvelle demande"}>
      {correcting && <Notice kind="info"><p>Votre dossier précédent et la décision de CASA restent conservés. Corrigez au moins votre déclaration, votre sélection de preuves ou le contenu d’une preuve : un dossier identique est refusé.</p></Notice>}
      <div className="field">
        <label htmlFor="request-statement">{correcting ? "Votre déclaration corrigée" : "Votre déclaration"}</label>
        <textarea id="request-statement" rows={6} maxLength={MAX_STATEMENT} required value={statement} onChange={event => setStatement(event.target.value)} />
        <p className="editor-hint">{statement.length} / {MAX_STATEMENT} caractères. Expliquez en quoi vous remplissez les critères.</p>
      </div>
      <fieldset className="choice-group">
        <legend>Preuves de votre portfolio (facultatif)</legend>
        {evidences.length === 0 && <p className="editor-hint">Votre portfolio est vide. <Link to="/app/portfolio">Ajoutez des preuves</Link> pour appuyer votre demande.</p>}
        {evidences.map(evidence => (
          <label key={evidence.id} className="choice">
            <input type="checkbox" checked={selected.has(evidence.id)} onChange={() => toggle(evidence.id)} />
            <span><strong>{evidence.title}</strong></span>
          </label>
        ))}
        <p className="editor-hint">Les preuves choisies sont copiées au moment de l’envoi : l’examen ne dépend pas de vos modifications ultérieures.</p>
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <div className="form-foot">
        <span className="admin-count">{selected.size} preuve(s) jointe(s)</span>
        <button type="submit" className="btn btn-primary" disabled={submitting || !statement.trim()}>{submitting ? "Envoi…" : correcting ? "Envoyer mon dossier corrigé à CASA" : "Envoyer ma demande à CASA"}</button>
      </div>
    </form>
  );
}

/** Demande de certification officielle : l'éligibilité affichée plus haut est indicative, seule une décision explicite de CASA délivre un
 * certificat. Chaque dossier est décidé une fois ; après un refus, un **nouveau dossier corrigé** peut être déposé, l'ancien et sa décision
 * restant conservés. L'historique complet est affiché, le dossier courant étant celui qui n'a pas de successeur. */
export function CertificationRequestSection({ certificationId, certificationTitle }: { certificationId: string; certificationTitle: string }) {
  const [requests, setRequests] = useState<CertificationRequest[] | undefined>(undefined);
  const [evidences, setEvidences] = useState<PortfolioEvidence[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    Promise.all([
      allPages(params => certificationService.listMyRequests(params), 100),
      portfolioService.listMine(),
    ]).then(([all, portfolio]) => {
      if (!active) return;
      setRequests(all.filter(request => request.certification_id === certificationId));
      setEvidences(portfolio);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [certificationId, reload]);

  const retry = useCallback(() => setReload(value => value + 1), []);
  const current = useMemo(() => (requests ? currentRequest(requests) : null), [requests]);
  const earlier = useMemo(() => (requests ?? []).filter(request => request.id !== current?.id).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)), [requests, current]);

  if (loadError) return <div role="alert" className="section-error"><p>Impossible de charger votre demande de certification.</p><button type="button" className="btn btn-secondary" onClick={retry}>Réessayer la demande</button></div>;
  if (requests === undefined) return <p role="status">Chargement de votre demande…</p>;

  return (
    <section className="panel request-section" aria-labelledby="request-title">
      <h2 id="request-title">Demande de certification officielle</h2>
      <p className="editor-hint">La certification est une validation officielle délivrée par CASA Institut après examen. Les critères ci-dessus sont une aide : les remplir ne délivre rien.</p>
      {current ? (
        <>
          <CertificationRequestView request={current} certificationTitle={certificationTitle} />
          {current.status === "REJECTED" && (
            <>
              <h3>Déposer un dossier corrigé</h3>
              <RequestForm key={current.id} certificationId={certificationId} previous={current} evidences={evidences} onCreated={created => setRequests(list => [created, ...(list ?? [])])} onConflict={retry} />
            </>
          )}
          {earlier.length > 0 && (
            <div className="request-history">
              <h3>Dossiers précédents ({earlier.length})</h3>
              {earlier.map(request => (
                <details key={request.id} className="subpanel">
                  <summary>Dossier du {formatDate(request.submitted_at)} : {request.status === "REJECTED" ? "refusé par CASA" : request.status === "APPROVED" ? "approuvé par CASA" : "en attente de décision"}</summary>
                  <CertificationRequestView request={request} certificationTitle={certificationTitle} />
                </details>
              ))}
            </div>
          )}
          <Link to="/app/certification-requests" className="btn btn-secondary">Voir toutes mes demandes</Link>
        </>
      ) : (
        <RequestForm certificationId={certificationId} previous={null} evidences={evidences} onCreated={created => setRequests([created])} onConflict={retry} />
      )}
    </section>
  );
}
