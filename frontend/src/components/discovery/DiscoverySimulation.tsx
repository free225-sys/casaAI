import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { Link } from "../AppLink";
import type { SceneKey } from "../../utils/discoveryRegistry";
import { SCENE_TEXTS, SIMULATION_LABEL, type SceneText } from "./discoveryContent";
import { GUIDED_EXAMPLES, MAP_POINTS, illustrativeVector, stepProbabilities, type GuidedExample } from "./discoveryExamples";

export interface SceneCourseLink { id: string; title: string }
export type SceneLinks = Partial<Record<SceneKey, SceneCourseLink[]>>;

const sceneText = (key: SceneKey): SceneText => SCENE_TEXTS.find(scene => scene.key === key)!;

function SceneFrame({ index, scene, links, children, headingRef }: { index: number; scene: SceneText; links?: SceneCourseLink[]; children: ReactNode; headingRef?: Ref<HTMLHeadingElement> }) {
  const headingId = useId();
  return (
    <li className="discovery-scene">
      <section aria-labelledby={headingId}>
        <h3 id={headingId} tabIndex={-1} ref={headingRef}><span className="discovery-num">{index}</span> {scene.title}</h3>
        <p>{scene.text}</p>
        {children}
        {scene.note && <p className="discovery-hint">{scene.note}</p>}
        {links && links.length > 0 && (
          <p className="discovery-links-line">Pour aller plus loin : {links.map((course, i) => <span key={course.id}>{i > 0 && ", "}<Link to={`/courses/${encodeURIComponent(course.id)}`}>{course.title}</Link></span>)}.</p>
        )}
      </section>
    </li>
  );
}

function MessageScene({ example, onChoose, ...frame }: { example: GuidedExample; onChoose: (index: number) => void; index: number; scene: SceneText; links?: SceneCourseLink[] }) {
  return (
    <SceneFrame {...frame}>
      <fieldset className="discovery-choice">
        <legend>Choisissez un exemple de message</legend>
        {GUIDED_EXAMPLES.map((item, i) => (
          <label key={item.key} className="discovery-radio">
            <input type="radio" name="discovery-example" checked={item.key === example.key} onChange={() => onChoose(i)} />
            <span>{item.prompt}</span>
          </label>
        ))}
      </fieldset>
      <div className="discovery-box">
        <p className="discovery-box-title">Contexte simplifié (exemple)</p>
        <ul>
          <li><strong>Consigne de l’application :</strong> « Tu es un assistant poli et concis. »</li>
          <li><strong>Conversation précédente :</strong> aucune.</li>
          <li><strong>Votre message :</strong> « {example.prompt} »</li>
        </ul>
      </div>
    </SceneFrame>
  );
}

function TokensScene({ example, ...frame }: { example: GuidedExample; index: number; scene: SceneText; links?: SceneCourseLink[] }) {
  const words = example.prompt.trim().split(/\s+/).length;
  return (
    <SceneFrame {...frame}>
      <ul className="discovery-tokens" aria-label="Tokens du message, avec leur identifiant inventé">
        {example.promptTokens.map((token, i) => (
          <li key={i}><span className="discovery-token-text">{token.text}</span><span className="discovery-token-id">{token.id}</span></li>
        ))}
      </ul>
      <p className="discovery-hint">{example.promptTokens.length} tokens pour {words} mots dans ce découpage illustratif. Identifiants inventés.</p>
    </SceneFrame>
  );
}

function RepresentationsScene({ example, ...frame }: { example: GuidedExample; index: number; scene: SceneText; links?: SceneCourseLink[]; headingRef?: Ref<HTMLHeadingElement> }) {
  const [selected, setSelected] = useState(0);
  const selectId = useId();
  const token = example.promptTokens[Math.min(selected, example.promptTokens.length - 1)];
  const vector = illustrativeVector(token.id);
  return (
    <SceneFrame {...frame}>
      <div className="field">
        <label htmlFor={selectId}>Token à examiner</label>
        <select id={selectId} value={selected} onChange={event => setSelected(Number(event.target.value))}>
          {example.promptTokens.map((item, i) => <option key={i} value={i}>{i + 1}. « {item.text.trim() || "␣"} » (identifiant {item.id})</option>)}
        </select>
      </div>
      <div className="discovery-box" aria-live="polite">
        <p><strong>Identifiant inventé :</strong> {token.id}</p>
        <p><strong>Vecteur illustratif (4 valeurs sur des centaines ou des milliers) :</strong> <span className="mono">[{vector.join(" ; ")} ; …]</span></p>
      </div>
      <figure className="discovery-map">
        <svg viewBox="0 0 100 100" role="img" aria-label="Carte illustrative à deux axes : chat, chaton et chien sont proches ; voiture, camion et vélo sont proches entre eux, loin des animaux.">
          <rect x="1" y="1" width="98" height="98" rx="6" className="discovery-map-bg" />
          {MAP_POINTS.map(point => (
            <g key={point.word}>
              <circle cx={point.x} cy={point.y} r="2.2" className="discovery-map-dot" />
              <text x={point.x + 3.5} y={point.y + 1.6} className="discovery-map-label">{point.word}</text>
            </g>
          ))}
        </svg>
        <figcaption>Carte illustrative : chat, chaton et chien sont proches ; voiture, camion et vélo sont proches entre eux, loin des animaux.</figcaption>
      </figure>
    </SceneFrame>
  );
}

function ModelScene({ example, ...frame }: { example: GuidedExample; index: number; scene: SceneText; links?: SceneCourseLink[] }) {
  const tokens = example.promptTokens;
  const [position, setPosition] = useState(Math.min(2, tokens.length - 1));
  const used = position + 1;
  return (
    <SceneFrame {...frame}>
      <p className="discovery-hint">Choisissez une position pour voir quels tokens elle peut utiliser.</p>
      <ol className="discovery-positions" aria-label="Positions du message">
        {tokens.map((token, i) => {
          const isUsed = i <= position;
          return (
            <li key={i} data-used={isUsed}>
              <button type="button" aria-pressed={i === position} onClick={() => setPosition(i)}>
                <span className="discovery-token-text">{token.text}</span>
                <span className="discovery-position-state">{i === position ? "position choisie" : isUsed ? "utilisé" : "non utilisé"}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="discovery-box">
        Position {used} (« {tokens[position].text.trim() || "␣"} ») : utilise les tokens 1 à {used}.{" "}
        {used < tokens.length ? `Elle n’utilise aucun des ${tokens.length - used} tokens suivants.` : "Il n’y a aucun token suivant."}
      </p>
      <p className="discovery-hint">Ce calcul se répète dans de nombreuses couches (souvent des dizaines).</p>
    </SceneFrame>
  );
}

function GenerationScene({ example, ...frame }: { example: GuidedExample; index: number; scene: SceneText; links?: SceneCourseLink[] }) {
  const [done, setDone] = useState(0);
  const [variety, setVariety] = useState(30);
  const rangeId = useId();
  const total = example.steps.length;
  const current = done > 0 ? example.steps[done - 1] : null;
  const probabilities = current ? stepProbabilities(current, variety) : [];
  const produced = example.steps.slice(0, done).map(step => step[0].text).join("");
  return (
    <SceneFrame {...frame}>
      <div className="field">
        <label htmlFor={rangeId}>Réglage de variété : <output>{variety}</output></label>
        <input id={rangeId} type="range" min={0} max={100} step={5} value={variety} onChange={event => setVariety(Number(event.target.value))} aria-valuetext={variety < 34 ? "moins varié" : variety > 66 ? "plus varié" : "variété moyenne"} />
        <span className="discovery-range-ends"><span>moins varié</span><span>plus varié</span></span>
      </div>
      <div className="discovery-actions">
        <button type="button" className="btn btn-primary" onClick={() => setDone(value => Math.min(total, value + 1))} disabled={done >= total}>Calculer le token suivant</button>
        <button type="button" className="btn btn-secondary" onClick={() => setDone(0)} disabled={done === 0}>Recommencer</button>
      </div>
      <div className="discovery-box" aria-live="polite">
        <p><strong>Réponse construite :</strong> {produced ? `« ${produced} »` : "aucun token pour l’instant"}{done >= total ? " (fin)" : ""}</p>
        {current && (
          <>
            <p className="discovery-hint">Candidats pour le token {done}, parmi les {current.length} montrés (probabilités illustratives) :</p>
            <ul className="discovery-candidates">
              {current.map((candidate, i) => (
                <li key={i}>
                  <span className="discovery-candidate-text">« {candidate.text} »{i === 0 && " (retenu ici)"}</span>
                  <span className="discovery-bar" aria-hidden="true"><span style={{ width: `${Math.round(probabilities[i] * 100)}%` }} /></span>
                  <span className="discovery-pct">{Math.round(probabilities[i] * 100)} %</span>
                </li>
              ))}
            </ul>
            <p className="discovery-hint">Dans cette simulation, le choix est fixé à l’avance : le réglage ne change que les probabilités affichées.</p>
          </>
        )}
      </div>
    </SceneFrame>
  );
}

function ResponseScene({ example, ...frame }: { example: GuidedExample; index: number; scene: SceneText; links?: SceneCourseLink[] }) {
  const answer = example.steps.map(step => step[0].text);
  return (
    <SceneFrame {...frame}>
      <ul className="discovery-tokens" aria-label="Tokens de la réponse préécrite">
        {answer.map((text, i) => <li key={i}><span className="discovery-token-text">{text}</span></li>)}
        <li><span className="discovery-token-text discovery-end">‹fin›</span></li>
      </ul>
      <div className="discovery-box">
        <p><strong>Réponse préécrite :</strong> « {answer.join("")} »</p>
        <p className="discovery-hint">{SIMULATION_LABEL} Elle peut être plausible sans être exacte.</p>
      </div>
    </SceneFrame>
  );
}

/** Module de simulation : six scènes, les deux premières visibles et les quatre suivantes dépliables sur place. Aucune saisie libre, aucune requête,
 * aucun stockage : tout est local et préécrit. Aucune animation automatique (mouvement réduit sans objet) : chaque changement vient d'une action. */
export default function DiscoverySimulation({ sceneLinks = {} }: { sceneLinks?: SceneLinks }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [unfolded, setUnfolded] = useState(false);
  const [announce, setAnnounce] = useState("");
  const firstNewHeading = useRef<HTMLHeadingElement>(null);
  const moreId = useId();
  const example = GUIDED_EXAMPLES[exampleIndex];

  useEffect(() => {
    if (!unfolded) return;
    setAnnounce("Scènes 3 à 6 affichées.");
    firstNewHeading.current?.focus();
  }, [unfolded]);

  const frame = (index: number, key: SceneKey) => ({ index, scene: sceneText(key), links: sceneLinks[key] });

  return (
    <div className="discovery-sim">
      <ol className="discovery-scenes">
        <MessageScene {...frame(1, "message")} example={example} onChoose={setExampleIndex} />
        <TokensScene {...frame(2, "tokens")} example={example} />
      </ol>
      {!unfolded && (
        <button type="button" className="btn btn-secondary discovery-more" aria-expanded={false} aria-controls={moreId} onClick={() => setUnfolded(true)}>
          Continuer : les 4 scènes suivantes
        </button>
      )}
      <p className="sr-only" role="status">{announce}</p>
      {unfolded && (
        <ol className="discovery-scenes" id={moreId} start={3} key={example.key}>
          <RepresentationsScene {...frame(3, "representations")} example={example} headingRef={firstNewHeading} />
          <ModelScene {...frame(4, "model")} example={example} />
          <GenerationScene {...frame(5, "generation")} example={example} />
          <ResponseScene {...frame(6, "response")} example={example} />
        </ol>
      )}
    </div>
  );
}
