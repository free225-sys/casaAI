import type { CertificationRequest } from "../types/api";
import { Status } from "./ui";
import "../styles/aurore-admin.css";
import { formatDate as formatDateTime } from "../utils/dates";

const EVIDENCE_FIELDS: Array<[string, string]> = [
  ["context", "Contexte"], ["problem", "Problème"], ["role", "Rôle"], ["deliverable", "Livrable"], ["result", "Résultat"], ["feedback", "Retour"],
];

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
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Lecture seule d'une demande et de sa décision : distingue la demande, la décision de CASA et le certificat officiel émis. */
export function CertificationRequestView({ request, certificationTitle, showApplicant }: { request: CertificationRequest; certificationTitle?: string; showApplicant?: boolean }) {
  return (
    <div className="request-view">
      <div className="ui-row">
        <Status value={request.status} />
        <span className="admin-count">Demande déposée le {formatDateTime(request.submitted_at)}</span>
      </div>
      <dl className="request-facts">
        <div><dt>Certification</dt><dd>{certificationTitle ?? request.certification_id}</dd></div>
        {showApplicant && <div><dt>Demandeur</dt><dd className="mono">{request.user_id}</dd></div>}
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
          <p className="editor-hint">La décision est définitive : une demande refusée n’est pas rouverte automatiquement.</p>
        </>
      )}
    </div>
  );
}
