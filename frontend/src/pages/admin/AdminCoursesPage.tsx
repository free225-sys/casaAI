import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminPagination, ADMIN_PAGE_SIZE } from "../../components/AdminPagination";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ConfirmDialog, EmptyState, Notice, PageHeader, Segmented, Status } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { useMyScopes } from "../../hooks/useMyScopes";
import { useScopedPathways } from "../../hooks/useScopedPathways";
import { adminService } from "../../services/adminService";
import { useAuth } from "../../stores/authStore";
import { adminRefusal } from "../../utils/adminErrors";
import { hasScope, scopePathwayIds, scopeSchoolIds } from "../../utils/scopes";
import { contentService } from "../../services/contentService";
import type { AdminCourse, PathwayListItem, School } from "../../types/api";

type StatusFilter = "all" | "PUBLISHED" | "DRAFT";
const STATUS_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "PUBLISHED", label: "Publiés" },
  { value: "DRAFT", label: "Brouillons" },
] as const;

export function AdminCoursesPage() {
  const { user } = useAuth();
  // Lot 2 : un ADMIN ne gère que le catalogue attribué ; le serveur filtre la liste et ses compteurs, l'écran ne fait que l'expliquer.
  const scoped = user?.role === "ADMIN";
  const myScopes = useMyScopes(scoped);
  const myPathways = useScopedPathways(scoped ? myScopes.scopes : null);
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsError, setSchoolsError] = useState(false);
  const [schoolsReload, setSchoolsReload] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminCourse | null>(null);
  const refresh = () => setReloadKey((n) => n + 1);

  useEffect(() => {
    let active = true;
    setSchoolsError(false);
    contentService.listSchools().then(rows => { if (active) setSchools(rows); }).catch(() => { if (active) setSchoolsError(true); });
    return () => { active = false; };
  }, [schoolsReload]);

  useEffect(() => {
    let cancelled = false;
    setCourses(null);
    setError(null);
    adminService
      .listCourses({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: ADMIN_PAGE_SIZE,
        offset: page * ADMIN_PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return;
        const lastPage = Math.max(0, Math.ceil(res.total / ADMIN_PAGE_SIZE) - 1);
        if (page > lastPage) { setPage(lastPage); return; }
        setCourses(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les cours.");
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, page, reloadKey]);

  const handlePublishToggle = async (course: AdminCourse) => {
    setActionError(null);
    setPendingId(course.id);
    try {
      await adminService.updateCourse(course.id, {
        ...course,
        status: course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
      });
      refresh();
    } catch (e) {
      setActionError(adminRefusal(e, "save", "La modification du statut a échoué."));
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setActionError(null);
    setPendingId(toDelete.id);
    try {
      await adminService.deleteCourse(toDelete.id);
      setToDelete(null);
      refresh();
    } catch (e) {
      setToDelete(null);
      setActionError(adminRefusal(e, "delete", "La suppression a échoué."));
    } finally {
      setPendingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (courses ?? []).filter((c) => !q || c.title.toLowerCase().includes(q));
  }, [courses, query]);
  const attributedSchoolIds = scoped && myScopes.scopes ? scopeSchoolIds(myScopes.scopes) : [];
  const noScope = scoped && myScopes.scopes !== null && !hasScope(myScopes.scopes);
  const schoolName = (id: string) => schools.find((school) => school.id === id)?.name ?? id;
  const searching = query.trim().length > 0;

  return (
    <AdminLayout>
      <PageHeader
        title="Cours"
        description="Cours de tous statuts. Un brouillon reste invisible des apprenants jusqu’à sa publication."
        actions={<>
          <button
            type="button"
            className="btn btn-primary"
            disabled={noScope}
            title={noScope ? "Un cours se crée dans une école ou un parcours qui vous est attribué." : undefined}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Annuler" : "Nouveau cours"}
          </button>
        </>}
      />

      {scoped && myScopes.error && <div role="alert" className="section-error"><p>Impossible de lire votre périmètre. La liste ci-dessous reste filtrée par le serveur.</p><button type="button" className="btn btn-secondary" onClick={myScopes.retry}>Réessayer le périmètre</button></div>}
      {noScope && <Notice kind="warning"><p>Aucun périmètre ne vous est attribué : vous ne voyez aucun contenu. Demandez à un super administrateur de vous attribuer des écoles ou des parcours.</p></Notice>}
      {scoped && myScopes.scopes && !noScope && <Notice kind="info"><p>Votre périmètre : {scopeSchoolIds(myScopes.scopes).length} école(s) et {scopePathwayIds(myScopes.scopes).length} parcours. La liste est filtrée par le serveur, compteurs compris.</p></Notice>}
      {schoolsError && <div role="alert" className="section-error"><p>Impossible de charger les écoles.</p><button type="button" className="btn btn-secondary" onClick={() => setSchoolsReload(value => value + 1)}>Réessayer les écoles</button></div>}
      {showForm && (
        <CourseCreateForm
          schools={schools}
          scoped={scoped}
          attributedSchoolIds={attributedSchoolIds}
          pathways={myPathways}
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
      {actionError && <Notice>{actionError}</Notice>}

      <section className="panel admin-list" aria-label="Liste des cours">
        <div className="admin-toolbar">
          <input className="input" type="search" aria-label="Rechercher un cours dans cette page" placeholder="Rechercher dans cette page…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Segmented<StatusFilter>
            label="Filtrer par statut"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(value) => { setStatusFilter(value); setPage(0); }}
          />
          <p className="admin-toolbar-note">La recherche porte uniquement sur les cours chargés dans cette page.</p>
        </div>

        {error && <div role="alert" className="section-error"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={refresh}>Réessayer les cours</button></div>}

        {courses === null && !error ? (
          <div className="admin-toolbar"><ListSkeleton count={4} /></div>
        ) : courses !== null && filtered.length === 0 ? (
          <EmptyState title={searching ? "Aucun cours ne correspond dans cette page" : noScope ? "Aucun contenu dans votre périmètre" : "Aucun cours pour ce filtre"}>
            {searching ? "Effacez la recherche ou changez de page." : noScope ? "Votre périmètre est vide : ce n’est pas une panne." : "Créez un cours, ou importez un PDF depuis l’onglet dédié."}
          </EmptyState>
        ) : courses !== null && (
          <table className="admin-table">
            <thead>
              <tr><th scope="col" className="col-status">Statut</th><th scope="col">Cours</th><th scope="col" className="col-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const busy = pendingId === c.id;
                return (
                  <tr key={c.id}>
                    <td className="col-status"><Status value={c.status} /></td>
                    <td>
                      <span className="admin-title">{c.title}</span>
                      <span className="admin-sub">{[schoolName(c.school_id), c.level].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="col-actions">
                      <div className="admin-actions">
                        <Link to={`/admin/courses/${c.id}`} className="btn btn-secondary">Gérer les leçons</Link>
                        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handlePublishToggle(c)}>
                          {busy ? "Enregistrement…" : c.status === "PUBLISHED" ? "Dépublier" : "Publier"}
                        </button>
                        <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setToDelete(c)}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {courses !== null && (
          <div className="admin-list-footer">
            <p className="admin-count" role="status">
              {searching
                ? `${filtered.length} résultat(s) affiché(s) sur ${courses.length} cours chargés dans cette page.`
                : `${courses.length} cours affiché(s) dans cette page.`}
            </p>
            <AdminPagination total={total} page={page} onPageChange={setPage} />
          </div>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title={`Supprimer « ${toDelete.title} » ?`}
          confirmLabel="Supprimer définitivement"
          busy={pendingId === toDelete.id}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        >
          <p>Le cours et toutes ses leçons seront supprimés définitivement. Pour retirer un cours publié du catalogue sans rien perdre, dépubliez-le.</p>
        </ConfirmDialog>
      )}
    </AdminLayout>
  );
}

function CourseCreateForm({ schools, scoped, attributedSchoolIds, pathways, onCreated }: { schools: School[]; scoped: boolean; attributedSchoolIds: string[]; pathways: PathwayListItem[]; onCreated: () => void }) {
  const [schoolId, setSchoolId] = useState(attributedSchoolIds.find(id => schools.some(school => school.id === id)) ?? schools[0]?.id ?? "");
  const [pathwayId, setPathwayId] = useState("");
  // Contrat du Lot 2 : un ADMIN crée dans une école attribuée ou en fournissant un parcours attribué ; le serveur reste l'autorité.
  const targetMissing = scoped && !attributedSchoolIds.includes(schoolId) && !pathwayId;
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId && schools.length > 0) setSchoolId(schools[0].id);
  }, [schools, schoolId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminService.createCourse({
        school_id: schoolId, pathway_id: scoped && pathwayId ? pathwayId : undefined, title, level: level || null, description: description || null, status: "DRAFT",
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="panel admin-form" aria-label="Nouveau cours">
      <div className="field">
        <label htmlFor="school">École</label>
        <select
          id="school"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
        >
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{scoped && attributedSchoolIds.includes(s.id) ? " (attribuée)" : ""}</option>
          ))}
        </select>
      </div>
      {scoped && pathways.length > 0 && (
        <div className="field">
          <label htmlFor="pathway">Parcours (facultatif)</label>
          <select id="pathway" value={pathwayId} onChange={(e) => setPathwayId(e.target.value)}>
            <option value="">Aucun parcours</option>
            {pathways.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <p className="editor-hint">Le cours est rattaché à ce parcours dès sa création.</p>
        </div>
      )}
      {targetMissing && <p className="editor-hint" role="status">Cette école ne vous est pas attribuée : choisissez l’un de vos parcours pour y rattacher le cours.</p>}
      <div className="field">
        <label htmlFor="title">Titre</label>
        <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="level">Niveau (optionnel)</label>
        <input id="level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="ex: N1" />
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <Notice>{error}</Notice>}
      <div className="form-foot">
        <span className="admin-count">Le cours est créé en brouillon.</span>
        <button type="submit" className="btn btn-primary" disabled={submitting || !title || !schoolId || targetMissing}>
          {submitting ? "Création…" : "Créer le cours (brouillon)"}
        </button>
      </div>
    </form>
  );
}
