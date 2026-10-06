import { useEffect, useRef, useState } from "react";
import { Link } from "./AppLink";
import { progressService } from "../services/progressService";
import { useAsyncSection } from "../hooks/useAsyncSection";

export function NotificationBell() {
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
    <button type="button" className="btn btn-secondary" aria-label="Notifications" aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) reload(); }}>
      {unread ? `Notif (${unread})` : "Notif"}
    </button>
    {open && <div className="account-menu-panel notification-panel" role="region" aria-label="Notifications récentes">
      {notifications.loading && <p role="status">Chargement des notifications…</p>}
      {notifications.error && <div role="alert"><p>Impossible de charger les notifications.</p><button type="button" className="btn btn-secondary" onClick={reload}>Réessayer les notifications</button></div>}
      {!notifications.loading && !notifications.error && notifications.data?.length === 0 && <p>Aucune notification.</p>}
      {notifications.data?.slice(0, 8).map(item => <div key={item.id} className={`notification-item${item.read ? "" : " is-unread"}`}>
        <strong>{item.title}</strong>{item.body && <p className="text-caption">{item.body}</p>}
      </div>)}
      <Link to="/app/profile">Régler les notifications</Link>
    </div>}
  </div>;
}
