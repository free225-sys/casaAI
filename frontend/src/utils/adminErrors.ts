import { ApiError } from "../services/apiClient";

/** Message affiché pour un refus serveur sur une action d'administration. Le serveur reste l'autorité : on n'interprète pas
 * ses règles, on les rapporte avec son propre message et une consigne sûre, sans jamais proposer de contourner un refus
 * (par exemple en supprimant les dépendances ou en réessayant). */
export function adminRefusal(error: unknown, action: "delete" | "save", fallback: string): string {
  if (error instanceof ApiError) {
    const detail = error.detail ? ` Détail du serveur : ${error.detail}` : "";
    if (error.status === 409 && action === "delete") {
      return `Suppression refusée : ce contenu a un historique ou des dépendances à conserver (progression, tentatives, certificats, quiz partagés ou rattachements). Rien n’a été supprimé. Dépubliez-le plutôt que de le supprimer.${detail}`;
    }
    if (error.status === 409) {
      return `Enregistrement refusé : la modification toucherait un contenu partagé ou hors de votre périmètre (par exemple un changement d’école ou de cours avec des quiz dépendants). Rien n’a été modifié.${detail}`;
    }
    if (error.status === 404) return "Ce contenu est introuvable ou hors de votre périmètre.";
    if (error.status === 403) return "Cette action n’est pas autorisée pour votre rôle ou votre périmètre.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
