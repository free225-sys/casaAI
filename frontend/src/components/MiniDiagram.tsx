/** Petit schéma statique pour aider la compréhension d'une section de leçon
 * (pas systématique — seulement les sections qui décrivent une relation, une
 * comparaison ou un processus). Non interactif, à la différence du schéma
 * des labos (InteractiveStepPipeline) : une leçon se lit en continu, elle
 * n'a pas besoin d'une nouvelle mécanique à apprendre. */
import type { CSSProperties } from "react";

interface HierarchyDiagram {
  type: "hierarchy";
  items: string[]; // du plus englobant au plus spécifique
  caption?: string;
}

interface FlowDiagram {
  type: "flow";
  steps: string[];
  caption?: string;
}

interface MatrixDiagram {
  type: "matrix";
  xLabel: string;
  yLabel: string;
  /** Dans l'ordre : haut-gauche, haut-droite, bas-gauche, bas-droite. */
  quadrants: [string, string, string, string];
  caption?: string;
}

export type MiniDiagramData = HierarchyDiagram | FlowDiagram | MatrixDiagram;

/* D10 : aucune bordure colorée. La structure est portée par la forme (imbrication, ordre numéroté, quadrants
 * titrés) et par le texte, jamais par la couleur seule ; contours neutres, texte à fort contraste. */
const OUTLINE = "var(--color-border-strong)";
const INK = "var(--color-text)";

function HierarchyLevel({ items, depth }: { items: string[]; depth: number }) {
  const [label, ...rest] = items;
  return (
    <div
      style={{
        border: `1px solid ${OUTLINE}`,
        borderRadius: "var(--radius-md)",
        background: depth % 2 === 0 ? "var(--color-surface)" : "white",
        padding: "10px 12px 12px",
        color: INK,
        fontSize: "0.85rem",
        fontFamily: "var(--font-mono)",
        overflowWrap: "anywhere",
      }}
    >
      <span style={{ display: "block", marginBottom: rest.length ? 10 : 0 }}>{label}</span>
      {rest.length > 0 && <HierarchyLevel items={rest} depth={depth + 1} />}
    </div>
  );
}

/** Niveaux imbriqués : l'inclusion est lue par la forme et par le texte (aria-label « A contient B »), pas par la couleur. */
function HierarchyView({ items, caption }: HierarchyDiagram) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div role="img" aria-label={items.join(" contient ")} style={{ maxWidth: 480 }}>
        <HierarchyLevel items={items} depth={0} />
      </div>
      {caption && (
        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: 8, fontStyle: "italic" }}>{caption}</p>
      )}
    </div>
  );
}

function FlowView({ steps, caption }: FlowDiagram) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>
        {steps.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${OUTLINE}`,
                color: INK,
                background: "var(--color-surface-raised)",
                fontSize: "0.85rem",
                fontFamily: "var(--font-mono)",
                overflowWrap: "anywhere",
              }}
            >
              <span style={{ color: "var(--color-text-muted)", marginRight: 8 }}>{i + 1}.</span>{label}
            </div>
            {i < steps.length - 1 && (
              <span style={{ padding: "0 8px", color: "var(--color-text-muted)" }} aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>
      {caption && (
        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: 10, fontStyle: "italic" }}>{caption}</p>
      )}
    </div>
  );
}

function MatrixView({ xLabel, yLabel, quadrants, caption }: MatrixDiagram) {
  const [topLeft, topRight, bottomLeft, bottomRight] = quadrants;
  const cellStyle: CSSProperties = {
    padding: "16px 14px",
    fontSize: "0.82rem",
    fontFamily: "var(--font-mono)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    minHeight: 64,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: "0.72rem",
            color: "var(--color-text-muted)",
            textAlign: "center",
            paddingBottom: 4,
          }}
        >
          {yLabel}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
            }}
          >
            <div style={{ ...cellStyle, background: "var(--color-accent-teal-soft)", color: INK, borderRight: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
              {topLeft}
            </div>
            <div style={{ ...cellStyle, background: "var(--color-accent-gold-soft)", color: INK, borderBottom: "1px solid var(--color-border)" }}>
              {topRight}
            </div>
            <div style={{ ...cellStyle, color: "var(--color-text-muted)", borderRight: "1px solid var(--color-border)" }}>
              {bottomLeft}
            </div>
            <div style={{ ...cellStyle, color: "var(--color-text-muted)" }}>{bottomRight}</div>
          </div>
          <div style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 6 }}>
            {xLabel}
          </div>
        </div>
      </div>
      {caption && (
        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: 8, fontStyle: "italic" }}>{caption}</p>
      )}
    </div>
  );
}

export function MiniDiagram({ data }: { data: MiniDiagramData }) {
  if (data.type === "hierarchy") return <HierarchyView {...data} />;
  if (data.type === "flow") return <FlowView {...data} />;
  if (data.type === "matrix") return <MatrixView {...data} />;
  return null;
}
