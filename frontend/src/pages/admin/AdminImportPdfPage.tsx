import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "../../components/AppLink";
import { useAsyncSection } from "../../hooks/useAsyncSection";
import { useMyScopes } from "../../hooks/useMyScopes";
import { useScopedPathways } from "../../hooks/useScopedPathways";
import { AdminLayout } from "../../layouts/AdminLayout";
import { Notice, PageHeader, Stepper } from "../../components/ui";
import { adminService } from "../../services/adminService";
import { contentService } from "../../services/contentService";
import { useAuth } from "../../stores/authStore";
import { pathwayLabel } from "../../utils/pathways";
import { hasScope, scopeSchoolIds } from "../../utils/scopes";
import type {
  PdfImportResult,
  PdfPreviewResult,
  PdfPreviewSection,
  School,
} from "../../types/api";

const STEPS = ["Choisir le document", "Vérifier l’analyse", "Résultat"] as const;

/** Libellés des natures de bloc produites par le moteur d'import. */
const BLOCK_LABELS: Record<string, string> = {
  TEXT: "texte",
  LIST: "liste",
  CODE: "code",
  TABLE: "tableau",
  FORMULA: "formule",
  CAPTION: "légende",
};

function countBlocks(sections: PdfPreviewSection[]): number {
  return sections.reduce(
    (total, section) => total + section.blocks.length + countBlocks(section.children),
    0,
  );
}

/** Une branche de l'arbre. Les sections de premier niveau restent ouvertes :
 *  c'est la vue d'ensemble que l'on vient chercher avant de valider. */
function pageRange(section: PdfPreviewSection): string | null {
  if (section.page_start === null) return null;
  const end = section.page_end ?? section.page_start;
  return end > section.page_start ? `p. ${section.page_start + 1}–${end + 1}` : `p. ${section.page_start + 1}`;
}

function SectionNode({ section, depth }: { section: PdfPreviewSection; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = section.children.length > 0 || section.blocks.length > 0;
  const uncertain = section.confidence < 0.6;
  const pages = pageRange(section);

  return (
    <li>
      <button
        type="button"
        className={`pdf-node${depth === 0 ? " is-root" : ""}`}
        onClick={() => setOpen((value) => !value)}
        disabled={!hasChildren}
        aria-expanded={hasChildren ? open : undefined}
      >
        <span className="toggle" aria-hidden="true">{hasChildren ? (open ? "▾" : "▸") : "•"}</span>
        <span>{section.title}</span>
        {uncertain && <span className="status status-warning" title="Titre détecté avec une confiance faible">À vérifier</span>}
        {pages && <span className="pdf-pages">{pages}</span>}
      </button>

      {open && (
        <ul>
          {section.blocks.map((block, index) => (
            <li key={index} className="pdf-block">
              <span className="kind">{BLOCK_LABELS[block.kind] ?? block.kind.toLowerCase()}</span>
              <span className="text">{block.preview}{block.preview.length >= 160 && "…"}</span>
            </li>
          ))}
          {section.children.map((child) => (
            <SectionNode key={child.title + child.level} section={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AdminImportPdfPage() {
  const { user } = useAuth();
  // Lot 2 : un ADMIN n'importe que dans une école attribuée (et un parcours attribué, facultatif) ; le corpus sans cours est réservé au SUPER_ADMIN.
  const scoped = user?.role === "ADMIN";
  const myScopes = useMyScopes(scoped);
  const schoolLoad = useAsyncSection(contentService.listSchools);
  const allSchools: School[] = schoolLoad.data ?? [];
  const attributedSchoolIds = scoped && myScopes.scopes ? scopeSchoolIds(myScopes.scopes) : [];
  const schools: School[] = allSchools;
  const scopedPathways = useScopedPathways(scoped ? myScopes.scopes : null);
  const pathways = scopedPathways.pathways;
  const [pathwayId, setPathwayId] = useState("");
  const noScope = scoped && myScopes.scopes !== null && !hasScope(myScopes.scopes);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [schoolId, setSchoolId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [createCourse, setCreateCourse] = useState(true);
  // R8 : la cible (école, parcours) autorise l'analyse d'un ADMIN ; elle est figée avec l'aperçu et toute modification l'invalide.
  const [analyzedTarget, setAnalyzedTarget] = useState<{ schoolId: string; pathwayId: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PdfPreviewResult | null>(null);
  const [result, setResult] = useState<PdfImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const schoolKey = schools.map(school => school.id).join("|");
  const attributedKey = attributedSchoolIds.join("|");
  useEffect(() => {
    const ids = schoolKey ? schoolKey.split("|") : [];
    const attributed = attributedKey ? attributedKey.split("|") : [];
    // L'école choisie doit toujours appartenir à la liste ; un ADMIN part d'une école qui lui est attribuée quand il en a une.
    if (ids.length === 0) { if (schoolId) setSchoolId(""); }
    else if (!ids.includes(schoolId)) setSchoolId(attributed.find(id => ids.includes(id)) ?? ids[0]);
  }, [schoolId, schoolKey, attributedKey]);
  // Contrat du Lot 2 : un ADMIN fournit une école attribuée OU un parcours attribué ; le serveur reste l'autorité.
  const targetMissing = scoped && !attributedSchoolIds.includes(schoolId) && !pathwayId;
  const targetStale = scoped && !!preview && (analyzedTarget?.schoolId !== schoolId || analyzedTarget?.pathwayId !== pathwayId);
  const selectedPathway = pathways.find(p => p.id === pathwayId);
  const selectedPathwayLabel = selectedPathway ? pathwayLabel(selectedPathway) : undefined;

  const [targetChanged, setTargetChanged] = useState(false);
  const changeTarget = (nextSchoolId: string, nextPathwayId: string) => {
    setSchoolId(nextSchoolId);
    setPathwayId(nextPathwayId);
    // Un aperçu d'ADMIN n'est valable que pour la cible analysée : la changer l'invalide, il faut analyser de nouveau.
    if (scoped && preview && !result && (nextSchoolId !== analyzedTarget?.schoolId || nextPathwayId !== analyzedTarget?.pathwayId)) {
      setPreview(null);
      setAnalyzedTarget(null);
      setTargetChanged(true);
    }
  };
  const chooseFile = (chosen: File | null) => {
    if (analyzing || importing) return;
    if (!chosen && fileInput.current) fileInput.current.value = "";
    setFile(chosen);
    setAnalyzedTarget(null);
    setTargetChanged(false);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || analyzing || importing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const preview = await adminService.previewPdf(file, scoped ? { schoolId, pathwayId: pathwayId || undefined } : undefined);
      if (mounted.current) { setPreview(preview); setAnalyzedTarget({ schoolId, pathwayId }); setTargetChanged(false); }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Échec de l'analyse.");
    } finally {
      if (mounted.current) setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !schoolId || importing || analyzing || !preview || result || noScope || targetMissing || targetStale) return;
    setImporting(true);
    setError(null);
    try {
      const result = await adminService.importPdf(file, schoolId, scoped ? true : createCourse, scoped && pathwayId ? pathwayId : undefined);
      if (mounted.current) setResult(result);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Échec de l'import.");
    } finally {
      if (mounted.current) setImporting(false);
    }
  };

  const report = preview?.report;
  const scanned = report?.document_type === "SCANNED";
  const step = result ? 2 : preview ? 1 : 0;
  const busy = analyzing || importing;
  const schoolName = schools.find(school => school.id === schoolId)?.name ?? "Aucune école sélectionnée";
  const blocks = preview ? countBlocks(preview.sections) : 0;
  const metrics = report ? ([
    ["sections", report.sections],
    ["sous-sections", report.subsections],
    ["blocs", report.blocks],
    ["listes", report.lists],
    ["tableaux", report.tables],
    ["formules", report.formulas],
    ["blocs de code", report.code_blocks],
    ["légendes", report.captions],
  ] as const).filter(([, value]) => value > 0) : [];

  const startOver = () => {
    if (busy) return;
    if (fileInput.current) fileInput.current.value = "";
    setAnalyzedTarget(null);
    setTargetChanged(false);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <AdminLayout>
      <div className="pdf-flow">
        <PageHeader title="Importer un PDF" description="Le document est d’abord analysé sans rien enregistrer. Vous vérifiez la structure et les points à relire avant toute création." />
        <Stepper current={step} labels={STEPS} />

        {!result && (
          <form onSubmit={handleAnalyze} className="panel admin-form" aria-label="Choisir le document">
            <div className="field pdf-file">
              <label htmlFor="file">Fichier PDF</label>
              <input
                id="file"
                ref={fileInput}
                disabled={busy}
                type="file"
                accept="application/pdf"
                aria-describedby="file-hint"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              />
              <p id="file-hint" className="text-caption">PDF avec couche texte. Les PDF scannés (sans texte) ne sont pas pris en charge : l’OCR n’existe pas.</p>
            </div>

            <div className="field">
              <label htmlFor="school">École de rattachement</label>
              <select
                id="school"
                disabled={busy || schoolLoad.loading}
                value={schoolId}
                onChange={(e) => changeTarget(e.target.value, pathwayId)}
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{scoped && attributedSchoolIds.includes(s.id) ? " (attribuée)" : ""}</option>
                ))}
              </select>
            </div>

            {pathways.length > 0 && (
              <div className="field">
                <label htmlFor="pathway">Parcours (facultatif)</label>
                <select id="pathway" disabled={busy} value={pathwayId} onChange={(e) => changeTarget(schoolId, e.target.value)}>
                  <option value="">Aucun parcours</option>
                  {pathways.map((p) => <option key={p.id} value={p.id}>{pathwayLabel(p)}</option>)}
                </select>
              </div>
            )}
            {scoped && myScopes.error && <div role="alert" className="section-error"><p>Impossible de lire votre périmètre : aucune école ne peut être proposée.</p><button type="button" className="btn btn-secondary" onClick={myScopes.retry}>Réessayer le périmètre</button></div>}
            {scoped && scopedPathways.error && <div role="alert" className="section-error"><p>Impossible de charger vos parcours : l’import avec rattachement à un parcours est indisponible.</p><button type="button" className="btn btn-secondary" onClick={scopedPathways.retry}>Réessayer les parcours</button></div>}
            {targetChanged && <Notice kind="warning"><p>La cible de l’import a changé : l’analyse précédente n’est plus valable. Lancez l’analyse de nouveau avant d’importer.</p></Notice>}
            {noScope && <Notice kind="warning"><p>Aucun périmètre ne vous est attribué : demandez à un super administrateur de vous attribuer une école ou un parcours avant d’importer.</p></Notice>}
            {!noScope && targetMissing && <p className="editor-hint" role="status">Choisissez une école qui vous est attribuée, ou l’un de vos parcours : un import doit s’inscrire dans votre périmètre.</p>}

            <fieldset className="choice-group">
              <legend>Que doit produire l’import ?</legend>
              <div className="choice-grid">
                <label className="choice">
                  <input type="radio" name="pdf-mode" checked={createCourse} disabled={busy} onChange={() => setCreateCourse(true)} />
                  <span><strong>Un cours en brouillon</strong><span>Cours et leçon créés en brouillon, à relire puis publier.</span></span>
                </label>
                <label className="choice">
                  <input type="radio" name="pdf-mode" checked={!createCourse} disabled={busy || scoped} onChange={() => setCreateCourse(false)} />
                  <span><strong>Un document de référence</strong><span>Versé au corpus documentaire, aucun cours créé. Pour un ouvrage entier.{scoped && " Réservé aux super administrateurs."}</span></span>
                </label>
              </div>
            </fieldset>

            {schoolLoad.error && <div role="alert" className="section-error"><p>Impossible de charger les écoles.</p><button type="button" className="btn btn-secondary" onClick={schoolLoad.retry}>Réessayer les écoles</button></div>}
            {error && <Notice>{error}</Notice>}

            <div className="form-foot">
              <span className="admin-count">{preview ? "Analyse affichée ci-dessous." : "L’analyse ne crée rien."}</span>
              <button type="submit" className="btn btn-primary" disabled={busy || !file || !schoolId || noScope || targetMissing}>
                {analyzing ? "Analyse en cours…" : "Analyser"}
              </button>
            </div>
          </form>
        )}

        {preview && !result && (
          <>
            <section className="panel" aria-labelledby="pdf-preview-title">
              <h2 id="pdf-preview-title">{preview.title}</h2>
              <p className="text-caption">
                {preview.pages} page{preview.pages > 1 ? "s" : ""} analysée{preview.pages > 1 ? "s" : ""}
                {typeof report?.average_confidence === "number" && ` · confiance moyenne ${Math.round(report.average_confidence * 100)} %`}
              </p>
              {metrics.length > 0 && (
                <ul className="pdf-kpis">
                  {metrics.map(([label, value]) => <li key={label}><strong>{value}</strong><span>{label}</span></li>)}
                </ul>
              )}
            </section>

            {scanned && (
              <Notice kind="warning">
                <p><strong>Ce PDF est probablement scanné :</strong> presque aucun texte n’a pu être extrait. L’OCR n’est pas pris en charge, l’import produirait une leçon vide.</p>
              </Notice>
            )}

            {report && report.anomalies.length > 0 && (
              <Notice kind="warning">
                <details open className="pdf-anomalies">
                  <summary>
                    {report.anomalies.length} élément{report.anomalies.length > 1 ? "s nécessitent" : " nécessite"} une vérification
                  </summary>
                  <ul>
                    {report.anomalies.map((anomaly, index) => (
                      <li key={index}>
                        {anomaly.page !== null && <span className="page-ref">p. {anomaly.page + 1}</span>}
                        {anomaly.message}
                      </li>
                    ))}
                  </ul>
                </details>
              </Notice>
            )}

            <section className="panel" aria-labelledby="pdf-structure-title">
              <h2 id="pdf-structure-title">Structure détectée</h2>
              {preview.sections.length > 0 ? (
                <ul className="pdf-tree">
                  {preview.sections.map((section) => (
                    <SectionNode key={section.title + section.level} section={section} depth={0} />
                  ))}
                </ul>
              ) : (
                <p>Aucune section n’a pu être reconstruite : le contenu sera importé d’un seul tenant.</p>
              )}
            </section>

            <section className="import-decision" aria-label="Résumé avant import">
              <dl>
                <dt>Fichier</dt><dd>{file?.name}</dd>
                <dt>École</dt><dd>{schoolName}</dd>
                {scoped && <><dt>Parcours</dt><dd>{pathwayId ? (selectedPathwayLabel ?? pathwayId) : "Aucun"}</dd></>}
                <dt>Mode</dt><dd>{createCourse ? "Créer un cours en brouillon" : "Document de référence uniquement"}</dd>
                <dt>À vérifier</dt><dd>{report?.anomalies.length ?? 0} point(s)</dd>
              </dl>
              <p className="decision-note">
                <strong>Rien n’a encore été enregistré.</strong>{" "}
                {createCourse ? "L’import créera un cours et une leçon en brouillon" : "Aucun cours ne sera créé"}
                {" "}({blocks} bloc{blocks > 1 ? "s" : ""}).
              </p>
              <div className="page-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={busy || schoolLoad.loading || schoolLoad.error || !schoolId || noScope || targetMissing || targetStale}
                >
                  {importing ? "Import en cours…" : createCourse ? "Valider et importer" : "Verser au corpus"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => chooseFile(null)}>
                  Choisir un autre fichier
                </button>
              </div>
            </section>
          </>
        )}

        {result && (
          <section className="panel pdf-result" aria-labelledby="pdf-result-title">
            <Notice kind="success">
              <p id="pdf-result-title"><strong>{result.course_id ? "Import terminé : brouillon créé." : "Document versé au corpus documentaire."}</strong></p>
              <p>{result.course_id ? "Le contenu n’est pas visible des apprenants tant qu’il n’est pas publié." : "Aucun cours n’a été créé."}</p>
            </Notice>
            <dl>
              <dt>Titre</dt><dd>{result.title}</dd>
              <dt>Pages extraites</dt><dd>{result.pages_extracted}</dd>
              <dt>École</dt><dd>{schoolName}</dd>
            </dl>
            {result.warning && <Notice kind="warning"><p>{result.warning}</p></Notice>}
            <div className="page-actions">
              {result.course_id && result.lesson_id && (
                <Link to={`/admin/courses/${result.course_id}/lessons/${result.lesson_id}`} className="btn btn-primary">Relire la leçon</Link>
              )}
              {result.course_id && (
                <Link to={`/admin/courses/${result.course_id}`} className="btn btn-secondary">Voir le cours</Link>
              )}
              <button type="button" className="btn btn-secondary" onClick={startOver}>Importer un autre PDF</button>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
