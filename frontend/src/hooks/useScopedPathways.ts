import { useEffect, useState } from "react";
import { contentService } from "../services/contentService";
import type { AdminScopes, PathwayListItem } from "../types/api";
import { allPages } from "../utils/pagination";
import { scopePathwayIds } from "../utils/scopes";

/** Parcours attribués à l'administrateur courant, avec leur titre (le périmètre ne porte que des identifiants). */
export function useScopedPathways(scopes: AdminScopes | null): PathwayListItem[] {
  const key = scopes ? scopePathwayIds(scopes).join("|") : "";
  const [pathways, setPathways] = useState<PathwayListItem[]>([]);
  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (ids.length === 0) { setPathways([]); return; }
    let active = true;
    allPages(contentService.listPathways, 20)
      .then(rows => { if (active) setPathways(rows.filter(row => ids.includes(row.id))); })
      .catch(() => { if (active) setPathways([]); });
    return () => { active = false; };
  }, [key]);
  return pathways;
}
