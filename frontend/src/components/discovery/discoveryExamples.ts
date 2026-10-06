/** Trois exemples guidés, entièrement préécrits. Aucun découpage, identifiant, vecteur, probabilité ni réponse ci-dessous ne vient d'un vrai modèle :
 * ils sont étiquetés comme illustratifs à l'écran. Aucune saisie libre n'existe : cette donnée est le seul contenu que la simulation manipule. */
export interface ExampleToken { text: string; id: number }
export interface Candidate { text: string; score: number }
export interface GuidedExample {
  key: string;
  prompt: string;
  promptTokens: ExampleToken[];
  /** Un pas par token de la réponse : le premier candidat est celui retenu ici, le choix étant fixé à l'avance. */
  steps: Candidate[][];
}

const t = (text: string, id: number): ExampleToken => ({ text, id });
const c = (text: string, score: number): Candidate => ({ text, score });

export const GUIDED_EXAMPLES: readonly GuidedExample[] = [
  {
    key: "photosynthese",
    prompt: "Explique la photosynthèse à un enfant de dix ans.",
    promptTokens: [t("Explique", 8421), t(" la", 312), t(" photo", 5907), t("synth", 14033), t("èse", 902), t(" à", 77), t(" un", 195), t(" enfant", 2260), t(" de", 41), t(" dix", 3318), t(" ans", 1204), t(".", 13)],
    steps: [
      [c("Une", 3.0), c("La", 2.3), c("Les", 1.7)],
      [c(" plante", 3.1), c(" feuille", 2.0), c(" graine", 1.2)],
      [c(" se", 2.8), c(" fabrique", 2.1), c(" mange", 1.4)],
      [c(" nourrit", 3.0), c(" repose", 1.6), c(" nettoie", 1.1)],
      [c(" de", 2.9), c(" avec", 2.2), c(" grâce", 1.9)],
      [c(" lumière", 3.2), c(" soleil", 2.6), c(" eau", 1.8)],
      [c(".", 3.4), c(",", 1.9), c(" !", 1.0)],
    ],
  },
  {
    key: "mail",
    prompt: "Écris un mail pour reporter une réunion.",
    promptTokens: [t("Écris", 6530), t(" un", 195), t(" mail", 4417), t(" pour", 118), t(" report", 9902), t("er", 267), t(" une", 331), t(" réunion", 5184), t(".", 13)],
    steps: [
      [c("Bonjour", 3.2), c("Madame", 1.8), c("Objet", 1.5)],
      [c(",", 3.4), c(" à", 1.2), c(" !", 1.0)],
      [c(" je", 2.9), c(" nous", 2.2), c(" il", 1.0)],
      [c(" dois", 2.7), c(" souhaite", 2.5), c(" vais", 1.8)],
      [c(" reporter", 3.1), c(" déplacer", 2.4), c(" annuler", 1.5)],
      [c(" notre", 2.8), c(" la", 2.2), c(" cette", 1.6)],
      [c(" réunion", 3.3), c(" rencontre", 2.0), c(" séance", 1.4)],
      [c(".", 3.1), c(" de", 1.8), c(" demain", 1.6)],
    ],
  },
  {
    key: "rgpd",
    prompt: "Que veut dire RGPD ?",
    promptTokens: [t("Que", 1180), t(" veut", 2975), t(" dire", 804), t(" R", 51), t("GP", 22871), t("D", 36), t(" ?", 30)],
    steps: [
      [c("Règlement", 2.9), c("Sigle", 2.3), c("Loi", 1.9)],
      [c(" européen", 3.0), c(" général", 2.7), c(" français", 1.1)],
      [c(" de", 2.6), c(" sur", 2.4), c(" pour", 1.2)],
      [c(" protection", 3.1), c(" sécurité", 1.7), c(" gestion", 1.5)],
      [c(" des", 3.0), c(" de", 2.0), c(" d", 1.0)],
      [c(" données", 3.3), c(" personnes", 1.8), c(" citoyens", 1.2)],
      [c(".", 3.2), c(",", 1.8), c(" personnelles", 1.5)],
    ],
  },
];

/** Probabilités illustratives d'un pas : softmax des scores divisés par une « température » liée au réglage de variété (0 = moins varié, 100 = plus varié). */
export function stepProbabilities(candidates: Candidate[], variety: number): number[] {
  const temperature = 0.25 + (Math.min(100, Math.max(0, variety)) / 100) * 1.75;
  const weights = candidates.map(candidate => Math.exp(candidate.score / temperature));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(weight => weight / total);
}

/** Quatre valeurs illustratives par token : une fonction déterministe de l'identifiant inventé, qui n'a aucun lien avec un vrai vecteur. */
export function illustrativeVector(id: number): number[] {
  return [1, 2, 3, 4].map(k => Math.round(Math.sin(id * (k + 0.37)) * 100) / 100);
}

export const MAP_POINTS: ReadonlyArray<{ word: string; x: number; y: number }> = [
  { word: "chat", x: 22, y: 30 }, { word: "chaton", x: 30, y: 22 }, { word: "chien", x: 16, y: 44 },
  { word: "voiture", x: 74, y: 66 }, { word: "camion", x: 84, y: 58 }, { word: "vélo", x: 68, y: 78 },
];
