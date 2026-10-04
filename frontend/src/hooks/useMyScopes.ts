import { useCallback, useEffect, useState } from "react";
import { adminService } from "../services/adminService";
import type { AdminScopes } from "../types/api";

/** Périmètre du compte d'administration courant. `enabled` est faux pour les rôles sans filtre (SUPER_ADMIN) : aucun appel.
 * Les réponses obsolètes sont ignorées ; une erreur reste distincte d'un périmètre vide. */
export function useMyScopes(enabled: boolean) {
  const [scopes, setScopes] = useState<AdminScopes | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) { setScopes(null); setError(false); setLoading(false); return; }
    let active = true;
    setLoading(true); setError(false);
    adminService.getMyScopes()
      .then(value => { if (active) setScopes(value); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, revision]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  return { scopes, error, loading, retry };
}
