import type { AdminPathwayReference, ContentStatus } from "../types/api";

const STATUS_LABELS: Record<ContentStatus, string> = { PUBLISHED: "", DRAFT: " (brouillon)", ARCHIVED: " (archivé)" };

/** Libellé d'un parcours du référentiel administratif : le statut n'est précisé que s'il n'est pas « publié ». */
export function pathwayLabel(pathway: AdminPathwayReference): string {
  return `${pathway.title}${STATUS_LABELS[pathway.status] ?? ""}`;
}
