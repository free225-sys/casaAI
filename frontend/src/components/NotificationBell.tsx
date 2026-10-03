import { useEffect, useRef, useState } from "react";
import { Link } from "./AppLink";
import { progressService } from "../services/progressService";
import type { AppNotification } from "../types/api";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    progressService.listNotifications().then(setItems).catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="btn btn-secondary" aria-label="Notifications" aria-expanded={open} onClick={() => { setOpen((v) => !v); if (!open) load(); }}>
        {unread > 0 ? `Notif (${unread})` : "Notif"}
      </button>
      {open && (
        <div className="account-menu-panel notification-panel" role="menu">
          {items.length === 0 ? (
            <p className="text-caption" style={{ padding: 10 }}>Aucune notification.</p>
          ) : (
            items.slice(0, 8).map((n) => (
              <div key={n.id} className={`notification-item${n.read ? "" : " is-unread"}`}>
                <strong>{n.title}</strong>
                {n.body && <p className="text-caption">{n.body}</p>}
              </div>
            ))
          )}
          <Link to="/app/profile">Régler les notifications</Link>
        </div>
      )}
    </div>
  );
}
