import type { CertificationRequest } from "../types/api";
import { Link } from "./AppLink";
import { Status } from "./ui";
import "../styles/aurore-admin.css";
import { formatDate as formatDateTime } from "../utils/dates";

const EVIDENCE_FIELDS: Array<[string, string]> = [
  ["context", "Contexte"], ["problem", "Problème"], ["role", "Rôle"], ["deliverable", "Livrable"], ["result", "Résultat"], ["feedback", "Retour"],
];

/** Valeur structurée d'une métrique figée : texte pour un scalaire, liste ou paires clé/valeur sinon (profondeur bornée). React échappe tout. */
function MetricValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <>—</>;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return <>{String(value)}</>;
  if (depth >= 3) return <>{JSON.stringify(value)}</>;
  if (Array.isArray(value)) return <ul className="request-metrics">{value.map((item, index) => <li key={index}><MetricValue value={item} depth={depth + 1} /></li>)}</ul>;
  return (
    <dl className="request-metrics">
      {Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key}><dt>{key}</dt><dd><MetricValue value={item} depth={depth + 1} /></dd></div>)}
    </dl>
  );
}

function hasMetrics(metrics: unknown): boolean {
  if (metrics === null || metrics === undefined || metrics === "") return false;
  if (Array.isArray(metrics)) return metrics.length > 0;
  if (typeof metrics === "object") return Object.keys(metrics as object).length > 0;
  return true;
}

/** Une preuve telle que figée à la dépôt de la demande (`evidence_snapshot`) : l'examen ne dépend pas des modifications ultérieures du portfolio. */
export function EvidenceSnapshot({ snapshot }: { snapshot: Array<Record<string, unknown>> }) {
  if (snapshot.length === 0) return <p className="editor-hint">Aucune preuve jointe à cette demande.</p>;
  return (
    <ul className="request-evidence">
      {snapshot.map((evidence, index) => (
        <li key={String(evidence.id ?? index)} className="subpanel">
          <strong>{String(evidence.title ?? "Preuve sans titre")}</strong>
          <dl>
            {EVIDENCE_FIELDS.filter(([key]) => typeof evidence[key] === "string" && evidence[key] !== "").map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{String(evidence[key])}</dd></div>
            ))}
            {hasMetrics(evidence.metrics) && <div><dt>Métriques</dt><dd><MetricValue value={evidence.metrics} /></dd></div>}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Lecture seule d'une demande et de sa décision : distingue la demande, la décision de CASA et le certificat officiel émis. */
export function CertificationRequestView({ request, certificationTitle, showApplicant, previousHref }: { request: CertificationRequest; certificationTitle?: string; showApplicant?: boolean; previousHref?: string }) {
  return (
    <div className="request-view">
      <div className="ui-row">
        <Status value={request.status} />
        <span className="admin-count">Demande déposée le {formatDateTime(request.submitted_at)}</span>
      </div>
      <dl className="request-facts">
        <div><dt>Certification</dt><dd>{certificationTitle ?? request.certification_id}</dd></div>
        {showApplicant && <div><dt>Demandeur</dt><dd>{request.applicant_display_name ? <>{request.applicant_display_name} <span className="mono admin-sub">({request.user_id})</span></> : <span className="mono">{request.user_id}</span>}</dd></div>}
        {request.previous_request_id && <div><dt>Dossier corrigé</dt><dd>{previousHref ? <Link to={previousHref}>Voir le dossier refusé précédent</Link> : "Ce dossier corrige un dossier refusé précédent, conservé dans l’historique."}</dd></div>}
      </dl>
      <h3>Déclaration du demandeur</h3>
      <p className="request-statement">{request.statement}</p>
      <h3>Preuves jointes ({request.evidence_snapshot.length})</h3>
      <EvidenceSnapshot snapshot={request.evidence_snapshot} />
      {request.status !== "SUBMITTED" && (
        <>
          <h3>Décision de CASA Institut</h3>
          <dl className="request-facts">
            <div><dt>Décision</dt><dd>{request.status === "APPROVED" ? "Approuvée" : "Refusée"}{request.decided_at ? ` le ${formatDateTime(request.decided_at)}` : ""}</dd></div>
            {request.reason && <div><dt>Motif</dt><dd>{request.reason}</dd></div>}
            {request.status === "APPROVED" && request.official_certificate_id && <div><dt>Certificat officiel</dt><dd className="mono">{request.official_certificate_id}</dd></div>}
          </dl>
          <p className="editor-hint">{request.status === "REJECTED" ? "Ce dossier reste conservé tel quel : il n’est pas rouvert. Un dossier corrigé peut être déposé à sa suite." : "La décision est définitive pour ce dossier."}</p>
        </>
      )}
    </div>
  );
}
