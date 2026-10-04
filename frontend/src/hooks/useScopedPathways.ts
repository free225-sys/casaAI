import { useCallback, useEffect, useState } from "react";
import { contentService } from "../services/contentService";
import type { AdminScopes, PathwayListItem } from "../types/api";
import { allPages } from "../utils/pagination";
import { scopePathwayIds } from "../utils/scopes";

/** Parcours attribués à l'administrateur courant, avec leur titre (le périmètre ne porte que des identifiants).
 *
 * Le catalogue public ne liste que les parcours publiés : un parcours attribué mais non publié (brouillon) n'y figure pas. Son
 * identifiant, connu par le périmètre, reste proposé sous une étiquette explicite plutôt que perdu. Une panne du référentiel est
 * un état d'erreur avec nouvelle tentative, jamais une liste vide (qui se lirait comme « aucun parcours »). */
export function useScopedPathways(scopes: AdminScopes | null) {
  const key = scopes ? scopePathwayIds(scopes).join("|") : "";
  const [pathways, setPathways] = useState<PathwayListItem[]>([]);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const ids = key ? key.split("|") : [];
    setError(false);
    if (ids.length === 0) { setPathways([]); return; }
    let active = true;
    allPages(contentService.listPathways, 20)
      .then(rows => {
        if (!active) return;
        const known = rows.filter(row => ids.includes(row.id));
        const unpublished = ids.filter(id => !known.some(row => row.id === id)).map<PathwayListItem>(id => ({ id, title: `Parcours attribué non publié (${id})`, profile_label: null, level: null, duration_label: null, color: null, description: null }));
        setPathways([...known, ...unpublished]);
      })
      .catch(() => { if (active) { setError(true); setPathways([]); } });
    return () => { active = false; };
  }, [key, revision]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  return { pathways, error, retry };
}
