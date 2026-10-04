import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "./AppLink";
import { CertificationRequestView } from "./CertificationRequestView";
import { Notice } from "./ui";
import { ApiError } from "../services/apiClient";
import { certificationService } from "../services/certificationService";
import { portfolioService } from "../services/portfolioService";
import type { CertificationRequest, PortfolioEvidence } from "../types/api";
import { allPages } from "../utils/pagination";

const MAX_STATEMENT = 10000;

/** Demande de certification officielle : l'éligibilité affichée plus haut est indicative, seule une décision explicite de CASA
 * délivre un certificat. Une demande par certification ; décision terminale ; aucune réouverture ni téléchargement inventé. */
export function CertificationRequestSection({ certificationId, certificationTitle }: { certificationId: string; certificationTitle: string }) {
  const [existing, setExisting] = useState<CertificationRequest | null | undefined>(undefined);
  const [evidences, setEvidences] = useState<PortfolioEvidence[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [statement, setStatement] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(false); setExisting(undefined);
    Promise.all([
      allPages(params => certificationService.listMyRequests(params), 100),
      portfolioService.listMine(),
    ]).then(([requests, portfolio]) => {
      if (!active) return;
      setExisting(requests.find(request => request.certification_id === certificationId) ?? null);
      setEvidences(portfolio);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [certificationId, reload]);

  const retry = useCallback(() => setReload(value => value + 1), []);
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !statement.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const created = await certificationService.submitRequest({ certification_id: certificationId, evidence_ids: [...selected], statement: statement.trim() });
      setExisting(created);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) { setError("Une demande existe déjà pour cette certification avec un contenu différent : elle ne peut pas être remplacée. Rien n’a été envoyé."); retry(); }
      else if (e instanceof ApiError && e.status === 404) setError("Une des preuves sélectionnées est introuvable : actualisez la page et sélectionnez de nouveau vos preuves.");
      else if (e instanceof ApiError && e.status === 403) setError("Seul un compte apprenant peut déposer une demande de certification.");
      else if (e instanceof ApiError && e.status === 422) setError(`Demande refusée par le serveur : ${e.detail || "vérifiez la déclaration et les preuves."}`);
      else setError("La demande n’a pas pu être envoyée. Votre saisie est conservée : vous pouvez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) return <div role="alert" className="section-error"><p>Impossible de charger votre demande de certification.</p><button type="button" className="btn btn-secondary" onClick={retry}>Réessayer la demande</button></div>;
  if (existing === undefined) return <p role="status">Chargement de votre demande…</p>;

  return (
    <section className="panel request-section" aria-labelledby="request-title">
      <h2 id="request-title">Demande de certification officielle</h2>
      <p className="editor-hint">La certification est une validation officielle délivrée par CASA Institut après examen. Les critères ci-dessus sont une aide : les remplir ne délivre rien.</p>
      {existing ? (
        <>
          <CertificationRequestView request={existing} certificationTitle={certificationTitle} />
          <Link to="/app/certification-requests" className="btn btn-secondary">Voir toutes mes demandes</Link>
        </>
      ) : (
        <form onSubmit={submit} className="admin-form">
          <div className="field">
            <label htmlFor="request-statement">Votre déclaration</label>
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
            <p className="editor-hint">Les preuves choisies sont copiées au moment de l’envoi : l’examen ne dépend pas de vos modifications ultérieures. Une seule demande est possible par certification et la décision est définitive.</p>
          </fieldset>
          {error && <Notice>{error}</Notice>}
          <div className="form-foot">
            <span className="admin-count">{selected.size} preuve(s) jointe(s)</span>
            <button type="submit" className="btn btn-primary" disabled={submitting || !statement.trim()}>{submitting ? "Envoi…" : "Envoyer ma demande à CASA"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
