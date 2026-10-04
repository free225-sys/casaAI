import type { AdminScopes } from "../types/api";

/** Identifiants des écoles et parcours attribués, quelle que soit la forme (listes à plat ou attributions détaillées). */
export function scopeSchoolIds(scopes: AdminScopes): string[] {
  return scopes.school_ids ?? scopes.grants.flatMap(grant => (grant.school_id ? [grant.school_id] : []));
}

export function scopePathwayIds(scopes: AdminScopes): string[] {
  return scopes.pathway_ids ?? scopes.grants.flatMap(grant => (grant.pathway_id ? [grant.pathway_id] : []));
}

export function hasScope(scopes: AdminScopes): boolean {
  return scopes.global_access || scopeSchoolIds(scopes).length + scopePathwayIds(scopes).length > 0;
}
