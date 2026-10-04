import type { ReactNode } from "react";
import { NavLink } from "../components/AppLink";
import { useAuth } from "../stores/authStore";
import "../styles/aurore-admin.css";

// Onglets filtrés par rôle : "Utilisateurs" est réservé à SUPER_ADMIN
// (gestion des comptes, hors périmètre "contenu" d'un ADMIN simple).
// "Cours" et "Importer un PDF" sont accessibles aux deux rôles admin.
const TABS = [
  { to: "/admin/users", label: "Utilisateurs", roles: ["SUPER_ADMIN"] as const },
  { to: "/admin/progress", label: "Progression", roles: ["SUPER_ADMIN"] as const },
  { to: "/admin/certifications", label: "Certifications", roles: ["SUPER_ADMIN"] as const },
  { to: "/admin/certification-requests", label: "Demandes CASA", roles: ["SUPER_ADMIN"] as const },
  { to: "/admin/courses", label: "Cours", roles: ["ADMIN", "SUPER_ADMIN"] as const },
  { to: "/admin/import-pdf", label: "Importer un PDF", roles: ["ADMIN", "SUPER_ADMIN"] as const },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const visibleTabs = TABS.filter((tab) => user && (tab.roles as readonly string[]).includes(user.role));

  return (
    <div className="admin-workspace">
      <div className="admin-top">
        <p className="admin-eyebrow">
          Administration · {user?.role === "SUPER_ADMIN" ? "Super administrateur" : "Admin contenu"}
        </p>
        {/* NavLink pose aria-current="page" sur l'onglet actif, qui porte l'indicateur coloré. */}
        <nav aria-label="Administration" className="admin-tabs">
          {visibleTabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
