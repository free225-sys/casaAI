import type { CertificationRequest } from "../types/api";

/** Dossier courant d'une certification : celui qui n'a pas de successeur. Les liens `previous_request_id` font foi, pas la date. */
export function currentRequest(requests: CertificationRequest[]): CertificationRequest | null {
  const open = requests.filter(request => !requests.some(other => other.previous_request_id === request.id));
  return [...open].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] ?? null;
}

/** Dossier qui corrige `request` (son successeur), s'il existe. */
export function successorOf(request: CertificationRequest, requests: CertificationRequest[]): CertificationRequest | undefined {
  return requests.find(other => other.previous_request_id === request.id);
}
