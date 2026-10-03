import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Link } from "./AppLink";
import { useAuth } from "../stores/authStore";
import type { UserRole } from "../types/api";

/**
 * Garde de route générique par rôle(s). Remplace l'ancien RequireAdmin
 * (rôle unique) maintenant qu'il existe deux niveaux de privilège admin :
 *   - ADMIN       : gestion de contenu (cours/leçons/import PDF).
 *   - SUPER_ADMIN : utilisateurs, progression globale, certifications
 *                   (sur-ensemble d'ADMIN pour le contenu aussi).
 *
 * Usage :
 *   <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>...</RequireRole>
 *   <RequireRole roles={["SUPER_ADMIN"]}>...</RequireRole>
 */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Chargement…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !roles.includes(user.role)) {
    const isContentAdmin = user?.role === "ADMIN";
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Accès insuffisant</h1>
        <p className="error-text" style={{ marginBottom: 20 }}>
          {isContentAdmin
            ? "Cette section est réservée aux super administrateurs."
            : "Votre rôle ne permet pas d’ouvrir cette page."}
        </p>
        <Link to={isContentAdmin ? "/admin/courses" : "/"} className="btn btn-secondary">
          {isContentAdmin ? "Retour à l’admin contenu" : "Retour à l’accueil"}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
