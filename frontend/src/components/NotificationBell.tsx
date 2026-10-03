import { useEffect, useRef, useState } from "react";
import { Link } from "./AppLink";
import { progressService } from "../services/progressService";
import { useAsyncSection } from "../hooks/useAsyncSection";
import { useAuth } from "../stores/authStore";

export function NotificationBell() {
  // La seule préférence de notification existante concerne les badges, donc l'espace apprenant ; la lecture des notifications reste commune.
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const notifications = useAsyncSection(progressService.listNotifications);
  const ref = useRef<HTMLDivElement>(null);
  const reload = notifications.retry;
  useEffect(() => {
    window.addEventListener("badges-updated", reload);
    return () => window.removeEventListener("badges-updated", reload);
  }, [reload]);
  useEffect(() => {
    if (!open) return;
    const click = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); ref.current?.querySelector("button")?.focus(); } };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const unread = notifications.data?.filter(item => !item.read).length ?? 0;
  return <div className="account-menu" ref={ref}>
    <button type="button" className="icon-btn" aria-label={`Notifications${unread ? ` : ${unread} non lue(s)` : ""}`} aria-controls="notifications-panel" aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) reload(); }}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unread > 0 && <span className="notification-count" aria-hidden="true">{unread}</span>}
    </button>
    {open && <div id="notifications-panel" className="account-menu-panel notification-panel" role="region" aria-label="Notifications récentes">
      {notifications.loading && <p role="status">Chargement des notifications…</p>}
      {notifications.error && <div role="alert"><p>Impossible de charger les notifications.</p><button type="button" className="btn btn-secondary" onClick={reload}>Réessayer les notifications</button></div>}
      {!notifications.loading && !notifications.error && notifications.data?.length === 0 && <p>Aucune notification.</p>}
      {notifications.data?.slice(0, 8).map(item => <div key={item.id} className={`notification-item${item.read ? "" : " is-unread"}`}>
        <strong>{item.title}</strong>{item.body && <p className="text-caption">{item.body}</p>}
      </div>)}
      {user?.role === "LEARNER" && <Link to="/app/profile">Régler les notifications</Link>}
    </div>}
  </div>;
}
