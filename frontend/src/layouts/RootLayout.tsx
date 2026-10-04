import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Nav } from "../components/Nav";

export function RootLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const workspace = pathname === "/app/dashboard" || pathname.startsWith("/admin/");
  const learn = pathname.startsWith("/app/lessons/");
  return (
    <div className={workspace ? "workspace-canvas" : undefined} style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <Nav />
      <main id="contenu" style={{ flex: 1, padding: "40px 0 80px" }}>
        <div className={learn ? "container container--learn" : "container"}>{children}</div>
      </main>
      <footer className={pathname === "/login" ? "site-footer site-footer--center" : "site-footer"}>
        <div className="container">
          <p>Propulsé par <a href="http://www.relaisit.com/" target="_blank" rel="noopener noreferrer">Relais IT<span className="sr-only"> (s’ouvre dans un nouvel onglet)</span></a></p>
        </div>
      </footer>
    </div>
  );
}
