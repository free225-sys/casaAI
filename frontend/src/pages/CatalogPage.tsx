import { useEffect, useMemo, useState } from "react";
import { Link } from "../components/AppLink";
import { RevealSection } from "../components/RevealSection";
import { PathwayIcon, SchoolIcon } from "../components/ModuleIcon";
import { EmptyState, PageHeader, Segmented } from "../components/ui";
import { CardGridSkeleton } from "../components/Skeleton";
import { contentService } from "../services/contentService";
import type { CourseListItem, LabListItem, PathwayListItem } from "../types/api";

/** Couleurs de repli par catégorie quand l'élément n'a pas de couleur propre
 * en base — permet de distinguer visuellement les 3 sections du catalogue
 * même sans donnée color renseignée. */
const FALLBACK_ACCENT = {
  pathway: "var(--color-accent-blue)",
  course: "var(--color-primary)",
  lab: "var(--color-primary)",
} as const;

async function allPages<T>(read: (params: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>, limit: number): Promise<T[]> {
  const items: T[] = [];
  let total = 1;
  while (items.length < total) {
    const page = await read({ limit, offset: items.length });
    total = page.total;
    if (page.items.length === 0 && items.length < total) throw new Error("Catalogue incomplet.");
    items.push(...page.items);
  }
  return items;
}

export function CatalogPage() {
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [pathways, setPathways] = useState<PathwayListItem[] | null>(null);
  const [labs, setLabs] = useState<LabListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [chip, setChip] = useState<"all" | "pathways" | "courses" | "labs">("all");

  useEffect(() => {
    let active = true;
    setError(false);
    Promise.all([
      allPages(contentService.listCourses, 50),
      allPages(contentService.listPathways, 20),
      allPages(contentService.listLabs, 20),
    ])
      .then(([coursesPage, pathwaysPage, labsPage]) => {
        if (!active) return;
        setCourses(coursesPage);
        setPathways(pathwaysPage);
        setLabs(labsPage);
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [reload]);

  const q = query.trim().toLowerCase();
  const matchesLevel = (value: string | null) => !level || value === level;
  const levels = [...new Set([...(pathways ?? []), ...(courses ?? []), ...(labs ?? [])].map(item => item.level).filter((value): value is string => !!value))].sort();
  const shownPathways = useMemo(
    () => (pathways ?? []).filter((p) => matchesLevel(p.level) && (!q || p.title.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q))),
    [pathways, q, level],
  );
  const shownCourses = useMemo(
    () => (courses ?? []).filter((c) => matchesLevel(c.level) && (!q || c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q))),
    [courses, q, level],
  );
  const shownLabs = useMemo(
    () => (labs ?? []).filter((l) => matchesLevel(l.level) && (!q || l.title.toLowerCase().includes(q) || (l.description ?? "").toLowerCase().includes(q))),
    [labs, q, level],
  );

  if (error) {
    return <div role="alert" className="section-error"><p>Impossible de charger le catalogue pour le moment.</p><button type="button" className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Réessayer le catalogue</button></div>;
  }

  return (
    <div>
      <PageHeader title="Catalogue" description="Parcours, cours et labs disponibles dès aujourd'hui." />
      <div className="catalog-controls">
        <div className="field"><label htmlFor="catalog-query">Rechercher dans le catalogue</label><input id="catalog-query" className="input" placeholder="Rechercher…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="field"><label htmlFor="catalog-level">Niveau</label><select id="catalog-level" value={level} onChange={event => setLevel(event.target.value)}><option value="">Tous les niveaux</option>{levels.map(value => <option key={value} value={value}>{value}</option>)}</select></div>
      </div>
      <Segmented label="Types de contenus" value={chip} options={[{value:"all",label:"Tout"},{value:"pathways",label:"Parcours"},{value:"courses",label:"Cours"},{value:"labs",label:"Labs"}]} onChange={setChip} />
      {courses !== null && pathways !== null && labs !== null && <p className="text-caption catalog-result-count" role="status">{(chip === "all" || chip === "pathways" ? shownPathways.length : 0) + (chip === "all" || chip === "courses" ? shownCourses.length : 0) + (chip === "all" || chip === "labs" ? shownLabs.length : 0)} résultat(s)</p>}
      <section style={{ marginBottom: 48, display: chip === "all" || chip === "pathways" ? "block" : "none" }}>
        <h2 className="catalog-section-title">Parcours</h2>
        {pathways !== null && shownPathways.length === 0 && <EmptyState title="Aucun résultat dans cette catégorie" action={<button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); setLevel(""); }}>Effacer les filtres</button>} />}
        {pathways === null ? (
          <CardGridSkeleton count={3} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: 16 }}>
            {shownPathways.map((p, i) => (
              <RevealSection key={p.id} as="div" delayMs={Math.min(i, 8) * 50} style={{ height: "100%" }}>
                <Link to={`/pathways/${p.id}`} className="card catalog-card">
                  <div className="catalog-card-kind"><PathwayIcon color={p.color ?? FALLBACK_ACCENT.pathway} /><span>Parcours</span></div>
                  <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{p.title}</h3>
                  <p className="catalog-description">{p.description}</p><p className="catalog-metadata">{[p.profile_label, p.level, p.duration_label].filter(Boolean).join(" · ")}</p>
                </Link>
              </RevealSection>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: chip === "all" || chip === "courses" ? "block" : "none" }}>
        <h2 className="catalog-section-title">Cours</h2>
        {courses !== null && shownCourses.length === 0 && <EmptyState title="Aucun résultat dans cette catégorie" action={<button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); setLevel(""); }}>Effacer les filtres</button>} />}
        {courses === null ? (
          <CardGridSkeleton count={6} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: 16 }}>
            {shownCourses.map((c, i) => (
              <RevealSection key={c.id} as="div" delayMs={Math.min(i, 8) * 50} style={{ height: "100%" }}>
                <Link to={`/courses/${c.id}`} className="card catalog-card">
                  <div className="catalog-card-kind"><SchoolIcon schoolId={c.school_id} color={c.color ?? FALLBACK_ACCENT.course} /><span>Cours</span></div>
                  <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{c.title}</h3>
                  <p className="catalog-description">{c.description}</p><p className="catalog-metadata">{[c.level, c.duration_min ? `${c.duration_min} min` : null].filter(Boolean).join(" · ")}</p>
                </Link>
              </RevealSection>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 48, display: chip === "all" || chip === "labs" ? "block" : "none" }}>
        <h2 className="catalog-section-title">Laboratoires</h2>
        {labs !== null && shownLabs.length === 0 && <EmptyState title="Aucun résultat dans cette catégorie" action={<button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); setLevel(""); }}>Effacer les filtres</button>} />}
        {labs === null ? (
          <CardGridSkeleton count={6} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: 16 }}>
            {shownLabs.map((l, i) => (
              <RevealSection key={l.id} as="div" delayMs={Math.min(i, 8) * 50} style={{ height: "100%" }}>
                <Link to={`/labs/${l.id}`} className="card catalog-card">
                  <div className="catalog-card-kind"><SchoolIcon schoolId={l.school_id} color={l.color ?? FALLBACK_ACCENT.lab} /><span>Lab</span></div>
                  <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{l.title}</h3>
                  <p className="catalog-description">{l.description}</p><p className="catalog-metadata">{[l.level, l.duration_min ? `${l.duration_min} min` : null].filter(Boolean).join(" · ")}</p>
                </Link>
              </RevealSection>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
