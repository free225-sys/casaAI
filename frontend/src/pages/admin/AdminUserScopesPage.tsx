import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Link } from "../../components/AppLink";
import { Notice, PageHeader } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ApiError } from "../../services/apiClient";
import { adminService } from "../../services/adminService";
import { contentService } from "../../services/contentService";
import type { AdminScopes, PathwayListItem, School } from "../../types/api";
import { allPages } from "../../utils/pagination";

interface Catalogue { schools: School[]; pathways: PathwayListItem[]; scopes: AdminScopes }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every(value => b.has(value));
}

/** Attribution du périmètre d'un administrateur de contenu (SUPER_ADMIN). Le serveur reste la source de vérité : l'écran
 * ne déduit aucun droit, il envoie le remplacement complet et affiche la réponse (ou l'erreur) telle quelle. */
export function AdminUserScopesPage() {
  const params = useParams();
  return <AdminUserScopesContent key={params.userId} />;
}

function AdminUserScopesContent() {
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const who = (location.state as { name?: string; email?: string } | null) ?? {};
  const [data, setData] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [schoolIds, setSchoolIds] = useState<Set<string>>(new Set());
  const [pathwayIds, setPathwayIds] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<{ schools: Set<string>; pathways: Set<string> }>({ schools: new Set(), pathways: new Set() });
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoadError(false); setData(null);
    Promise.all([
      contentService.listSchools(),
      allPages(contentService.listPathways, 20),
      adminService.getUserScopes(userId),
    ]).then(([schools, pathways, scopes]) => {
      if (!active) return;
      const initialSchools = new Set(scopes.school_ids ?? scopes.grants.flatMap(grant => (grant.school_id ? [grant.school_id] : [])));
      const initialPathways = new Set(scopes.pathway_ids ?? scopes.grants.flatMap(grant => (grant.pathway_id ? [grant.pathway_id] : [])));
      setData({ schools, pathways, scopes });
      setSchoolIds(initialSchools); setPathwayIds(initialPathways);
      setSaved({ schools: initialSchools, pathways: initialPathways });
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [userId, reload]);

  const schoolRows = useMemo(() => {
    const known = new Map((data?.schools ?? []).map(school => [school.id, school.name]));
    const unknown = [...schoolIds, ...saved.schools].filter(id => !known.has(id));
    return [...(data?.schools ?? []).map(school => ({ id: school.id, label: school.name })), ...[...new Set(unknown)].map(id => ({ id, label: `École inconnue (${id})` }))];
  }, [data, schoolIds, saved]);
  const pathwayRows = useMemo(() => {
    const known = new Map((data?.pathways ?? []).map(pathway => [pathway.id, pathway.title]));
    const unknown = [...new Set([...pathwayIds, ...saved.pathways].filter(id => !known.has(id)))];
    const q = filter.trim().toLowerCase();
    return [...(data?.pathways ?? []).map(pathway => ({ id: pathway.id, label: pathway.title })), ...unknown.map(id => ({ id, label: `Parcours inconnu (${id})` }))]
      .filter(row => !q || row.label.toLowerCase().includes(q) || pathwayIds.has(row.id));
  }, [data, pathwayIds, saved, filter]);

  const dirty = !sameSet(schoolIds, saved.schools) || !sameSet(pathwayIds, saved.pathways);
  const toggle = (set: Set<string>, setter: (next: Set<string>) => void, id: string) => {
    const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id);
    setter(next); setSuccess(false); setError(null);
  };

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true); setError(null); setSuccess(false);
    try {
      const result = await adminService.setUserScopes(userId, { school_ids: [...schoolIds], pathway_ids: [...pathwayIds] });
      const nextSchools = new Set(result.school_ids ?? result.grants.flatMap(grant => (grant.school_id ? [grant.school_id] : [])));
      const nextPathways = new Set(result.pathway_ids ?? result.grants.flatMap(grant => (grant.pathway_id ? [grant.pathway_id] : [])));
      setSchoolIds(nextSchools); setPathwayIds(nextPathways); setSaved({ schools: nextSchools, pathways: nextPathways });
      setData(current => (current ? { ...current, scopes: result } : current));
      setSuccess(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError("Ce compte n’est pas un administrateur de contenu : aucun périmètre ne peut lui être attribué.");
      else if (e instanceof ApiError && e.status === 403) setError("Seul un super administrateur peut attribuer un périmètre.");
      else if (e instanceof ApiError && e.status === 422) setError(`Attribution refusée par le serveur : ${e.detail || "école ou parcours inexistant."}`);
      else setError("L’attribution n’a pas pu être enregistrée. Le périmètre précédent est conservé.");
    } finally {
      setSaving(false);
    }
  };

  const lastAssigned = data?.scopes.grants.map(grant => grant.assigned_at).sort().at(-1);
  const title = who.name ? `Périmètre de ${who.name}` : "Périmètre d’un administrateur";

  if (loadError) return <AdminLayout><div role="alert" className="section-error"><p>Impossible de charger ce périmètre. Rien n’a été modifié.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer le chargement</button><Link to="/admin/users">Retour aux utilisateurs</Link></div></AdminLayout>;
  if (!data) return <AdminLayout><ListSkeleton count={4} height={44} /></AdminLayout>;

  return (
    <AdminLayout>
      <Link to="/admin/users" className="admin-back">← Retour aux utilisateurs</Link>
      <PageHeader title={title} description={who.email ? `${who.email} · attribution par école et par parcours` : "Attribution par école et par parcours"} />
      {error && <Notice>{error}</Notice>}
      {success && <Notice kind="success">Périmètre enregistré : {schoolIds.size} école(s), {pathwayIds.size} parcours.</Notice>}

      <div className="editor">
        <Notice kind="info">
          <p>Un administrateur de contenu ne voit et ne gère que le catalogue attribué. Sans attribution, il ne voit aucun contenu. Un cours partagé entre plusieurs parcours est lisible si l’un de ses parcours est attribué, et modifiable seulement si son école ou tous ses parcours sont attribués. Ces règles sont appliquées par le serveur.</p>
        </Notice>

        <fieldset className="panel editor-panel">
          <legend className="admin-title">Écoles <span className="admin-count">({schoolIds.size} sélectionnée(s) sur {data.schools.length})</span></legend>
          {schoolRows.length === 0 && <p className="editor-hint">Aucune école dans le catalogue.</p>}
          {schoolRows.map(row => (
            <label key={row.id} className="choice">
              <input type="checkbox" checked={schoolIds.has(row.id)} onChange={() => toggle(schoolIds, setSchoolIds, row.id)} />
              <span><strong>{row.label}</strong></span>
            </label>
          ))}
        </fieldset>

        <fieldset className="panel editor-panel">
          <legend className="admin-title">Parcours <span className="admin-count">({pathwayIds.size} sélectionné(s) sur {data.pathways.length})</span></legend>
          <div className="field">
            <label htmlFor="pathway-filter">Filtrer les parcours</label>
            <input id="pathway-filter" type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Titre du parcours…" />
            <p className="editor-hint">Les parcours déjà cochés restent affichés même s’ils ne correspondent pas au filtre.</p>
          </div>
          {pathwayRows.length === 0 && <p className="editor-hint" role="status">Aucun parcours ne correspond.</p>}
          {pathwayRows.map(row => (
            <label key={row.id} className="choice">
              <input type="checkbox" checked={pathwayIds.has(row.id)} onChange={() => toggle(pathwayIds, setPathwayIds, row.id)} />
              <span><strong>{row.label}</strong></span>
            </label>
          ))}
        </fieldset>

        {lastAssigned && <p className="editor-hint">Dernière attribution enregistrée le {formatDate(lastAssigned)}.</p>}
        <div className="editor-actions">
          <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? "Enregistrement…" : "Enregistrer le périmètre"}</button>
          <Link to="/admin/users" className="btn btn-secondary">{dirty ? "Abandonner les changements" : "Retour"}</Link>
          {dirty && <span className="editor-hint" role="status">Modifications non enregistrées.</span>}
        </div>
      </div>
    </AdminLayout>
  );
}
