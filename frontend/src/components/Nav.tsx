import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Link } from "./AppLink";
import { useAuth } from "../stores/authStore";
import { NotificationBell } from "./NotificationBell";
import { homePathFor } from "../utils/roles";

export function Nav() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  useEffect(() => { setOpen(false); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (accountOpen && accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
      if (open && headerRef.current && !headerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (accountOpen) { setAccountOpen(false); accountRef.current?.querySelector("button")?.focus(); }
      else if (open) { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open, accountOpen]);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure); observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const close = () => setOpen(false);
  const itemClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " is-active" : ""}`;
  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`;
  return <header ref={headerRef} className="site-header"><div className="container nav-bar">
    <Link to="/" className="nav-brand" onClick={close}>CASA <span className="brand-accent">AI</span> Institute</Link>
    <nav id="site-nav" className={`site-nav${open ? " is-open" : ""}`} aria-label="Principal">
      <NavLink to="/catalog" className={itemClass} onClick={close}>Catalogue</NavLink>
      {isAuthenticated && user?.role === "LEARNER" && <>
        <NavLink to="/app/dashboard" className={itemClass} onClick={close}>Mon espace</NavLink>
        <NavLink to="/app/quizzes" className={itemClass} onClick={close}>Quiz</NavLink>
        <NavLink to="/app/portfolio" className={itemClass} onClick={close}>Portfolio</NavLink>
        <NavLink to="/app/certifications" className={itemClass} onClick={close}>Certifications</NavLink>
      </>}
      {isAuthenticated && isAdmin && user && <NavLink to={homePathFor(user.role)} className={`nav-link${pathname.startsWith("/admin") ? " is-active" : ""}`} onClick={close}>Administration</NavLink>}
      {!isAuthenticated && <NavLink to="/login" className={itemClass} onClick={close}>Connexion</NavLink>}
    </nav>
    <div className="nav-tools">
      {isAuthenticated ? <><NotificationBell /><div className="account-menu" ref={accountRef}>
        <button type="button" className="icon-btn" aria-label={`Compte de ${user?.first_name ?? "l’utilisateur"}`} aria-expanded={accountOpen} aria-controls="account-panel" onClick={() => setAccountOpen(value => !value)}><span className="avatar" aria-hidden="true">{initials || "●"}</span></button>
        {accountOpen && <div id="account-panel" className="account-menu-panel" role="region" aria-label="Compte"><Link to="/app/profile" onClick={() => { setAccountOpen(false); close(); }}>Profil</Link><button type="button" className="btn btn-secondary" onClick={() => { setAccountOpen(false); logout(); navigate("/"); close(); }}>Se déconnecter</button></div>}
      </div></> : <NavLink to="/register" className="btn btn-primary" onClick={close}>S'inscrire</NavLink>}
      <button ref={toggleRef} type="button" className="icon-btn nav-toggle" aria-label="Menu principal" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
    </div>
  </div></header>;
}
