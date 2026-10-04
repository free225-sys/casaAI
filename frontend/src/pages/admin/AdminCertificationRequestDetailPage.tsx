import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { CertificationRequestView } from "../../components/CertificationRequestView";
import { ConfirmDialog, Notice, PageHeader } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ApiError } from "../../services/apiClient";
import { certificationService } from "../../services/certificationService";
import type { CertificationRequest } from "../../types/api";

const MAX_REASON = 10000;

/** Examen et décision d'une demande par le SUPER_ADMIN représentant CASA : décision motivée, terminale, atomique côté serveur. */
export function AdminCertificationRequestDetailPage() {
  const params = useParams();
  return <Content key={params.requestId} />;
}

function Content() {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<CertificationRequest | null>(null);
  const [title, setTitle] = useState<string | undefined>();
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "">("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    let active = true;
    setLoadError(false); setRequest(null);
    certificationService.adminGetRequest(requestId)
      .then(value => {
        if (!active) return;
        setRequest(value);
        certificationService.get(value.certification_id).then(cert => { if (active) setTitle(cert.title); }).catch(() => {});
      })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [requestId, reload]);

  const submit = async () => {
    if (!requestId || !decision || busy) return;
    setBusy(true); setError(null);
    try {
      const updated = await certificationService.decideRequest(requestId, { decision, reason: reason.trim() });
      setRequest(updated); setDone(true); setConfirming(false);
    } catch (e) {
      setConfirming(false);
      if (e instanceof ApiError && e.status === 409) setError(`Décision refusée : ${e.detail || "la demande a déjà reçu une décision différente, ou le demandeur ou la certification ne permet plus l’approbation."} Aucune modification n’a été enregistrée ; actualisez la demande.`);
      else if (e instanceof ApiError && e.status === 403) setError("Seul un super administrateur représentant CASA peut décider d’une demande.");
      else if (e instanceof ApiError && e.status === 404) setError("Cette demande est introuvable.");
      else if (e instanceof ApiError && e.status === 422) setError(`Décision refusée par le serveur : ${e.detail || "le motif est obligatoire."}`);
      else setError("La décision n’a pas pu être enregistrée. Rien n’indique qu’elle ait été prise : actualisez la demande avant de réessayer.");
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger cette demande. Aucune décision n’a été prise.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer le chargement</button><Link to="/admin/certification-requests">Retour aux demandes</Link></div></AdminLayout>;
  if (!request) return <AdminLayout><ListSkeleton count={4} height={44} /></AdminLayout>;

  const pending = request.status === "SUBMITTED";
  const canSubmit = !!decision && reason.trim().length > 0 && reason.length <= MAX_REASON;

  return (
    <AdminLayout>
      <Link to="/admin/certification-requests" className="admin-back">← Retour aux demandes</Link>
      <PageHeader title={title ? `Demande : ${title}` : "Demande de certification"} description="Examinez la déclaration et les preuves figées au dépôt, puis décidez au nom de CASA Institut." />
      {done && <Notice kind="success">Décision enregistrée : demande {request.status === "APPROVED" ? "approuvée, certificat officiel émis" : "refusée"}.</Notice>}
      {error && <Notice>{error}</Notice>}
      <section className="panel request-section" style={{ marginTop: 0 }}>
        <CertificationRequestView request={request} certificationTitle={title} showApplicant previousHref={request.previous_request_id ? `/admin/certification-requests/${request.previous_request_id}` : undefined} />
      </section>

      {pending && (
        <section className="panel request-section" aria-labelledby="decision-title">
          <h2 id="decision-title">Décision de CASA Institut</h2>
          <form className="decision-form" onSubmit={event => { event.preventDefault(); if (canSubmit) setConfirming(true); }}>
            <fieldset className="choice-group">
              <legend>Décision</legend>
              <div className="choice-grid">
                <label className="choice"><input type="radio" name="decision" checked={decision === "APPROVED"} onChange={() => setDecision("APPROVED")} /><span><strong>Approuver</strong><span>Émet un certificat officiel unique.</span></span></label>
                <label className="choice"><input type="radio" name="decision" checked={decision === "REJECTED"} onChange={() => setDecision("REJECTED")} /><span><strong>Refuser</strong><span>Aucun certificat n’est émis.</span></span></label>
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="decision-reason">Motif (obligatoire, transmis au demandeur)</label>
              <textarea id="decision-reason" rows={4} maxLength={MAX_REASON} required value={reason} onChange={event => setReason(event.target.value)} />
              <p className="editor-hint">{reason.length} / {MAX_REASON} caractères.</p>
            </div>
            <div className="editor-actions">
              <button type="submit" className="btn btn-primary" disabled={!canSubmit || busy}>Enregistrer la décision…</button>
              <span className="editor-hint">Une décision est définitive : elle ne peut être ni annulée ni modifiée.</span>
            </div>
          </form>
        </section>
      )}

      {confirming && decision && (
        <ConfirmDialog title={decision === "APPROVED" ? "Approuver cette demande ?" : "Refuser cette demande ?"} confirmLabel={decision === "APPROVED" ? "Approuver et émettre" : "Refuser définitivement"} busy={busy} onConfirm={submit} onCancel={() => setConfirming(false)}>
          <p>{decision === "APPROVED" ? "Un certificat officiel unique sera émis au nom de CASA Institut. Cette décision est définitive." : "La demande sera refusée sans émission de certificat. Elle ne sera pas rouverte automatiquement. Cette décision est définitive."}</p>
        </ConfirmDialog>
      )}
    </AdminLayout>
  );
}
