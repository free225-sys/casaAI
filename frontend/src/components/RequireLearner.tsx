import type { ReactNode } from "react";
import { Link } from "./AppLink";
import { useAuth } from "../stores/authStore";
import { homePathFor } from "../utils/roles";
import { ProtectedRoute } from "./ProtectedRoute";

/** Réserve une route pédagogique aux apprenants. Un administrateur voit un état explicite avec un lien vers son espace :
 * c'est le pendant du 403 serveur, jamais une déconnexion, et aucune page pédagogique n'est montée (donc aucun appel
 * progression, badges, compétences ou quiz pour ce compte). */
export function RequireLearner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {user && user.role !== "LEARNER" ? (
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <h1 style={{ marginBottom: 12 }}>Espace réservé aux apprenants</h1>
          <p style={{ marginBottom: 20 }}>
            Les parcours, quiz, badges et certificats personnels ne sont pas disponibles avec un compte d’administration.
          </p>
          <Link to={homePathFor(user.role)} className="btn btn-secondary">
            {user.role === "ADMIN" ? "Retour à l’administration du catalogue" : "Retour à l’administration"}
          </Link>
        </div>
      ) : (
        children
      )}
    </ProtectedRoute>
  );
}
