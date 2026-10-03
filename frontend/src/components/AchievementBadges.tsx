import type { AchievementBadge } from "../types/api";

export function AchievementBadges({ badges }: { badges: AchievementBadge[] | null }) {
  if (badges === null) return <p className="text-caption">Chargement des badges…</p>;
  if (badges.length === 0) return null;
  const earned = badges.filter(badge => badge.earned);
  const locked = badges.filter(badge => !badge.earned);
  const cards = (rows: AchievementBadge[]) => <div className="badge-grid">{rows.map(badge => <article key={badge.id} className={`achievement-badge${badge.earned ? " is-earned" : ""}`}><p className="achievement-badge-title">{badge.title}</p><p className="achievement-badge-desc">{badge.description}</p>{badge.new && <p className="text-caption">Nouveau</p>}</article>)}</div>;
  return <div className="achievement-list">{cards(earned)}{locked.length > 0 && <details><summary>Voir les {locked.length} badges à débloquer</summary>{cards(locked)}</details>}</div>;
}
