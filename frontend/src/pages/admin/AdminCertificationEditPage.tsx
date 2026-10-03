import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { Notice, PageHeader } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import type { AdminCertification, AdminCertificationRequirement, AdminCertificationRequirementType } from "../../types/api";

const TYPE_LABELS: Record<AdminCertificationRequirementType, string> = {
  COURSE: "Cours terminé",
  MIN_SCORE: "Score minimum sur un quiz de compétence",
  LAB: "Lab complété",
  SKILL: "Maîtrise de compétence",
  EVIDENCE: "Preuve libre (revue manuelle)",
  FINAL_PROJECT: "Projet final (revue manuelle)",
};

// Champ de référence attendu par type — cf. app/services/admin_certification_service.py
const REFERENCE_FIELD: Partial<Record<AdminCertificationRequirementType, "course_id" | "lab_id" | "skill_id">> = {
  COURSE: "course_id",
  LAB: "lab_id",
  SKILL: "skill_id",
  MIN_SCORE: "skill_id",
};

export function AdminCertificationEditPage() {
  const { certificationId } = useParams<{ certificationId: string }>();
  const [cert, setCert] = useState<AdminCertification | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AdminCertificationRequirement>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!certificationId) return;
    let active = true;
    setLoadError(false);
    setCert(null);
    adminService.getCertification(certificationId).then((c) => {
      if (!active) return;
      setCert(c);
      setDrafts(Object.fromEntries(c.requirements.map((r) => [r.id, r])));
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [certificationId, reloadKey]);

  const updateDraft = (id: string, patch: Partial<AdminCertificationRequirement>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const handleSave = async (requirementId: string) => {
    if (!certificationId) return;
    const draft = drafts[requirementId];
    setSavingId(requirementId);
    setErrors((e) => ({ ...e, [requirementId]: "" }));
    setSavedId(null);
    try {
      const updated = await adminService.updateCertificationRequirement(certificationId, requirementId, {
        requirement_type: draft.requirement_type,
        description: draft.description,
        course_id: draft.course_id || null,
        lab_id: draft.lab_id || null,
        skill_id: draft.skill_id || null,
        min_score: draft.min_score,
      });
      setDrafts((d) => ({ ...d, [requirementId]: updated }));
      setSavedId(requirementId);
    } catch (e) {
      setErrors((err) => ({ ...err, [requirementId]: e instanceof Error ? e.message : "Erreur." }));
    } finally {
      setSavingId(null);
    }
  };

  if (loadError) return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger cette certification. Aucun changement n’a été enregistré.</p><button type="button" className="btn btn-secondary" onClick={() => setReloadKey((n) => n + 1)}>Réessayer le chargement</button></div></AdminLayout>;
  if (!cert) return <AdminLayout><ListSkeleton count={3} height={140} /></AdminLayout>;

  return (
    <AdminLayout>
      <Link to="/admin/certifications" className="admin-back">← Retour aux certifications</Link>
      <PageHeader title={cert.title} description={cert.description} />

      <div className="editor">
        {cert.requirements.map((original, i) => {
          const draft = drafts[original.id] ?? original;
          const refField = REFERENCE_FIELD[draft.requirement_type];
          const id = `req-${original.id}`;
          return (
            <section key={original.id} className="panel editor-panel" aria-labelledby={`${id}-title`}>
              <h2 id={`${id}-title`} style={{ fontSize: "1rem" }}>Critère {i + 1} : {original.description || "(sans description)"}</h2>

              <div className="field-row">
                <div className="field">
                  <label htmlFor={`${id}-type`}>Type</label>
                  <select
                    id={`${id}-type`}
                    value={draft.requirement_type}
                    onChange={(e) => updateDraft(original.id, { requirement_type: e.target.value as AdminCertificationRequirementType })}
                  >
                    {Object.entries(TYPE_LABELS).map(([t, label]) => (
                      <option key={t} value={t}>{label}</option>
                    ))}
                  </select>
                </div>

                {refField && (
                  <div className="field">
                    <label htmlFor={`${id}-ref`}>
                      {refField === "course_id" ? "ID du cours" : refField === "lab_id" ? "ID du lab" : "ID de la compétence"}
                    </label>
                    <input
                      id={`${id}-ref`}
                      value={draft[refField] ?? ""}
                      onChange={(e) => updateDraft(original.id, { [refField]: e.target.value } as Partial<AdminCertificationRequirement>)}
                      placeholder={refField === "skill_id" ? "ex : ai-literacy" : refField === "course_id" ? "ex : agents-panorama" : "ex : rag-red-team"}
                    />
                  </div>
                )}

                {draft.requirement_type === "MIN_SCORE" && (
                  <div className="field">
                    <label htmlFor={`${id}-min`}>Score minimum (%)</label>
                    <input
                      id={`${id}-min`}
                      type="number" min={0} max={100}
                      value={draft.min_score ?? ""}
                      onChange={(e) => updateDraft(original.id, { min_score: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {(draft.requirement_type === "EVIDENCE" || draft.requirement_type === "FINAL_PROJECT") && (
                <p className="editor-hint">
                  Ce type de critère reste évalué manuellement : aucune référence à un quiz ou une compétence ne peut le rendre automatique.
                </p>
              )}

              {errors[original.id] && <Notice>{errors[original.id]}</Notice>}

              <div className="editor-actions">
                <button type="button" className="btn btn-primary" onClick={() => handleSave(original.id)} disabled={savingId === original.id}>
                  {savingId === original.id ? "Enregistrement…" : "Enregistrer ce critère"}
                </button>
                {savedId === original.id && <span className="saved-note" role="status">Critère enregistré.</span>}
              </div>
            </section>
          );
        })}
      </div>
    </AdminLayout>
  );
}
