import { useCallback, useEffect, useState } from "react";
import { adminService } from "../services/adminService";
import type { AdminPathwayReference, AdminScopes } from "../types/api";
import { allPages } from "../utils/pagination";
import { scopePathwayIds } from "../utils/scopes";

/** Parcours attribués à l'administrateur courant, tous statuts, lus dans le référentiel administratif (`GET /api/admin/pathways`,
 * limité par le serveur aux parcours explicitement attribués ; le catalogue public ne liste que les publiés).
 *
 * Un identifiant attribué que le référentiel ne renvoie plus (parcours supprimé) reste proposé sous une étiquette explicite plutôt
 * que perdu. Une panne est un état d'erreur avec nouvelle tentative, jamais une liste vide (qui se lirait comme « aucun parcours »). */
export function useScopedPathways(scopes: AdminScopes | null) {
  const key = scopes ? scopePathwayIds(scopes).join("|") : "";
  const [pathways, setPathways] = useState<AdminPathwayReference[]>([]);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const ids = key ? key.split("|") : [];
    setError(false);
    if (ids.length === 0) { setPathways([]); return; }
    let active = true;
    allPages(adminService.listPathways, 100)
      .then(rows => {
        if (!active) return;
        const known = rows.filter(row => ids.includes(row.id));
        const missing = ids.filter(id => !known.some(row => row.id === id)).map<AdminPathwayReference>(id => ({ id, title: `Parcours attribué introuvable (${id})`, status: "PUBLISHED" }));
        setPathways([...known, ...missing]);
      })
      .catch(() => { if (active) { setError(true); setPathways([]); } });
    return () => { active = false; };
  }, [key, revision]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  return { pathways, error, retry };
}
