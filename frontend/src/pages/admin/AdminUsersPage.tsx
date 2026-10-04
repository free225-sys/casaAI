import { useEffect, useState } from "react";
import { Link } from "../../components/AppLink";
import { AdminLayout } from "../../layouts/AdminLayout";
import { ConfirmDialog, EmptyState, Notice, PageHeader } from "../../components/ui";
import { ListSkeleton } from "../../components/Skeleton";
import { adminService } from "../../services/adminService";
import { useAuth } from "../../stores/authStore";
import type { AdminUser, UserRole } from "../../types/api";
import { AdminPagination, ADMIN_PAGE_SIZE } from "../../components/AdminPagination";

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin (contenu)",
  LEARNER: "Apprenant",
};

const STATUS_LABELS: Record<string, string> = { ACTIVE: "Actif", SUSPENDED: "Suspendu", PENDING: "En attente" };

type PendingAction =
  | { kind: "role"; user: AdminUser; role: UserRole }
  | { kind: "status"; user: AdminUser }
  | { kind: "delete"; user: AdminUser };

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => setReloadKey((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    setUsers(null); setError(null);
    adminService
      .listUsers({
        search: search || undefined,
        role: role || undefined,
        limit: ADMIN_PAGE_SIZE,
        offset: page * ADMIN_PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return;
        const lastPage = Math.max(0, Math.ceil(res.total / ADMIN_PAGE_SIZE) - 1);
        if (page > lastPage) { setPage(lastPage); return; }
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur.");
      });
    return () => {
      cancelled = true;
    };
  }, [search, role, page, reloadKey]);

  const runAction = async () => {
    if (!pending) return;
    const { kind, user: target } = pending;
    setActionError(null);
    setBusy(true);
    try {
      if (kind === "role") await adminService.updateUser(target.id, { role: pending.role });
      else if (kind === "status") await adminService.updateUser(target.id, { status: target.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
      else await adminService.deleteUser(target.id);
      setPending(null);
      refresh();
    } catch (e) {
      // Les gardes serveur (400 auto-modification, 409 dernier SUPER_ADMIN, 403) restent la source de vérité.
      setPending(null);
      setActionError(e instanceof Error ? e.message : "L’action a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const fullName = (u: AdminUser) => `${u.first_name} ${u.last_name}`.trim();
  const dialog = pending && (pending.kind === "role"
    ? { title: `Changer le rôle de ${fullName(pending.user)} ?`, confirm: "Changer le rôle",
        body: `Nouveau rôle : ${ROLE_LABELS[pending.role]}. ${pending.role === "SUPER_ADMIN" ? "Ce compte pourra gérer les utilisateurs, la progression et les certifications." : pending.user.role === "SUPER_ADMIN" ? "Ce compte perdra l’accès aux utilisateurs, à la progression et aux certifications." : "Les accès changent dès la prochaine requête de ce compte."}` }
    : pending.kind === "status"
      ? pending.user.status === "ACTIVE"
        ? { title: `Suspendre ${fullName(pending.user)} ?`, confirm: "Suspendre", body: "Le compte ne pourra plus se connecter. Ses données et sa progression sont conservées." }
        : { title: `Réactiver ${fullName(pending.user)} ?`, confirm: "Réactiver", body: "Le compte pourra de nouveau se connecter." }
      : { title: `Supprimer le compte de ${fullName(pending.user)} ?`, confirm: "Supprimer définitivement", body: "Le compte et ses données seront supprimés définitivement. Pour bloquer l’accès sans rien perdre, suspendez-le." });

  return (
    <AdminLayout>
      <PageHeader title="Utilisateurs" description="Rôles et statuts des comptes. Réservé aux super administrateurs." />
      {actionError && <Notice>{actionError}</Notice>}

      <section className="panel admin-list" aria-label="Liste des utilisateurs">
        <div className="admin-toolbar">
          <input
            className="input"
            type="search"
            aria-label="Rechercher par nom ou email"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <select
            className="input"
            aria-label="Filtrer par rôle"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as "" | UserRole);
              setPage(0);
            }}
          >
            <option value="">Tous les rôles</option>
            <option value="LEARNER">Apprenant</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super admin</option>
          </select>
        </div>

        {error && <div role="alert" className="section-error"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={refresh}>Réessayer les utilisateurs</button></div>}

        {users === null && !error ? (
          <div className="admin-toolbar"><ListSkeleton count={5} /></div>
        ) : users !== null && users.length === 0 ? (
          <EmptyState title="Aucun utilisateur pour ces critères">Modifiez la recherche ou le filtre de rôle.</EmptyState>
        ) : users !== null && (
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Utilisateur</th><th scope="col">Rôle et statut</th><th scope="col" className="col-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === currentUser?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="admin-title">{fullName(u)}{self && " (vous)"}</span>
                      <span className="admin-sub">{u.email}</span>
                    </td>
                    <td>
                      <span className="ui-row">
                        <span className={`role-pill${u.role === "SUPER_ADMIN" ? " is-super" : ""}`}>{ROLE_LABELS[u.role]}</span>
                        <span className={`status ${u.status === "ACTIVE" ? "status-published" : "status-suspended"}`}>{STATUS_LABELS[u.status] ?? u.status}</span>
                      </span>
                    </td>
                    <td className="col-actions">
                      <div className="admin-actions">
                        <select
                          className="input"
                          aria-label={`Rôle de ${fullName(u)}`}
                          value={u.role}
                          disabled={self || busy}
                          title={self ? "Vous ne pouvez pas changer votre propre rôle." : undefined}
                          onChange={(e) => {
                            const next = e.target.value as UserRole;
                            if (next !== u.role) setPending({ kind: "role", user: u, role: next });
                          }}
                        >
                          <option value="LEARNER">{ROLE_LABELS.LEARNER}</option>
                          <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                          <option value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</option>
                        </select>
                        {u.role === "ADMIN" && (
                          <Link to={`/admin/users/${u.id}/scopes`} state={{ name: fullName(u), email: u.email }} className="btn btn-secondary" aria-label={`Périmètre de ${fullName(u)}`}>
                            Périmètre
                          </Link>
                        )}
                        <button type="button" className="btn btn-secondary" disabled={self || busy} onClick={() => setPending({ kind: "status", user: u })}>
                          {u.status === "ACTIVE" ? "Suspendre" : "Réactiver"}
                        </button>
                        <button type="button" className="btn btn-danger" disabled={self || busy} onClick={() => setPending({ kind: "delete", user: u })}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {users !== null && (
          <div className="admin-list-footer">
            <p className="admin-count" role="status">{users.length} utilisateur(s) affiché(s) sur {total}.</p>
            <AdminPagination total={total} page={page} onPageChange={setPage} />
          </div>
        )}
      </section>

      {pending && dialog && (
        <ConfirmDialog title={dialog.title} confirmLabel={dialog.confirm} busy={busy} onConfirm={runAction} onCancel={() => setPending(null)}>
          <p>{dialog.body}</p>
        </ConfirmDialog>
      )}
    </AdminLayout>
  );
}
