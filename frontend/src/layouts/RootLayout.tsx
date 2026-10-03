import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Nav } from "../components/Nav";

export function RootLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const learn = pathname.startsWith("/app/lessons/");
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <Nav />
      <main id="contenu" style={{ flex: 1, padding: "40px 0 80px" }}>
        <div className={learn ? "container container--learn" : "container"}>{children}</div>
      </main>
    </div>
  );
}
