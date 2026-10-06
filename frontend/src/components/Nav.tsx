import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Link } from "./AppLink";
import { useAuth } from "../stores/authStore";
import { NotificationBell } from "./NotificationBell";

export function Nav() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountOpen]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const close = () => setOpen(false);
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? " is-active" : ""}`;

  return (
    <header ref={headerRef} className="site-header">
      <div className="container nav-bar">
        <Link to="/" className="nav-brand" onClick={close}>
          CASA <span style={{ color: "var(--color-accent-gold)" }}>AI</span> Institute
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <nav id="site-nav" className={`site-nav${open ? " is-open" : ""}`} aria-label="Principal">
          <NavLink to="/catalog" className={itemClass} onClick={close}>Catalogue</NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/app/dashboard" className={itemClass} onClick={close}>Mon espace</NavLink>
              <NavLink to="/app/quizzes" className={itemClass} onClick={close}>Quiz</NavLink>
              <NavLink to="/app/portfolio" className={itemClass} onClick={close}>Portfolio</NavLink>
              <NavLink to="/app/certifications" className={itemClass} onClick={close}>Certifications</NavLink>
              {isAdmin && (
                <NavLink to="/admin/courses" className={itemClass} onClick={close}>Admin</NavLink>
              )}
            </>
          )}
          {isAuthenticated ? (
            <div className="nav-account">
              <NotificationBell />
              <div className="account-menu" ref={accountRef}>
                <button type="button" className="btn btn-secondary" aria-expanded={accountOpen} onClick={() => setAccountOpen((v) => !v)}>
                  {user?.first_name}
                </button>
                {accountOpen && (
                  <div className="account-menu-panel" role="menu">
                    <Link to="/app/profile" onClick={() => { setAccountOpen(false); close(); }}>Profil</Link>
                    <button type="button" className="btn btn-secondary" onClick={() => { logout(); navigate("/"); close(); }}>
                      Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <NavLink to="/login" className={itemClass} onClick={close}>Connexion</NavLink>
              <NavLink to="/register" className="btn btn-primary" onClick={close}>S'inscrire</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
