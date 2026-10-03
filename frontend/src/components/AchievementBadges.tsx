import type { AchievementBadge } from "../types/api";

export function AchievementBadges({ badges }: { badges: AchievementBadge[] | null }) {
  if (badges === null) return <p className="text-caption">Chargement des badges…</p>;
  if (badges.length === 0) return null;
  return (
    <div className="badge-grid">
      {badges.map((b) => (
        <article key={b.id} className={`achievement-badge${b.earned ? " is-earned" : ""}`}>
          <p className="achievement-badge-title">{b.title}</p>
          <p className="achievement-badge-desc">{b.description}</p>
          {b.new && <p className="text-caption">Nouveau</p>}
        </article>
      ))}
    </div>
  );
}
