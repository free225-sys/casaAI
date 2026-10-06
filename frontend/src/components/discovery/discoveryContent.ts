import type { SceneKey } from "../../utils/discoveryRegistry";

/** Textes pédagogiques finaux des six scènes (DISCOVERY_V1 §13), repris tels quels. Ce fichier est dans le bundle principal : il alimente aussi le
 * repli texte, qui ne dépend donc ni du chargement ni de l'exécution du module de simulation. */
export const SIMULATION_LABEL = "Simulation illustrative, sans appel à un modèle.";

export interface SceneText { key: SceneKey; title: string; text: string; note?: string }

export const SCENE_TEXTS: readonly SceneText[] = [
  {
    key: "message",
    title: "Votre message",
    text: "Le modèle reçoit votre message, et peut aussi recevoir des consignes de l’application et des éléments de la conversation. Ici, nous montrons un contexte simplifié.",
    note: "Rien n’est envoyé : cette simulation reste dans votre navigateur.",
  },
  {
    key: "tokens",
    title: "Découpage en fragments (tokens)",
    text: "Le texte est découpé en unités appelées tokens : un token peut représenter un mot, une partie de mot ou un signe. Un mot peut produire plusieurs tokens. Le découpage dépend du tokenizer utilisé. Chaque token possède un identifiant ; les numéros montrés ici sont inventés.",
  },
  {
    key: "representations",
    title: "Des fragments aux nombres",
    text: "À chaque identifiant correspond une représentation numérique apprise : un vecteur. Le numéro d’identifiant n’est pas ce vecteur. L’ordre des tokens est pris en compte selon l’architecture. Les valeurs et la carte à deux axes sont illustratives, pas une carte réelle de ce que comprend un modèle.",
  },
  {
    key: "model",
    title: "Le calcul du modèle",
    text: "Dans ce modèle illustratif qui prédit la suite d’un texte, chaque position peut utiliser les tokens précédents et le token à cette position, sans regarder les tokens futurs. L’attention pondère des informations et se répète dans plusieurs couches de calcul. Ce schéma simplifié ne montre aucun raisonnement interne.",
  },
  {
    key: "generation",
    title: "Écrire la réponse, token par token",
    text: "Le modèle calcule des scores pour le prochain token. Selon le réglage, il retient le plus probable ou fait un choix parmi plusieurs candidats, puis recommence. Le cache clé-valeur réutilise des calculs d’attention déjà faits ; il ne supprime pas le travail sur le contexte. Dans l’exemple d’un cache qui conserve tous les tokens, mémoire et coût d’attention par étape augmentent avec sa longueur.",
    note: "Les probabilités affichées sont illustratives : elles ne viennent d’aucune inférence réelle. Le réglage de variété ne mesure ni l’exactitude ni la confiance.",
  },
  {
    key: "response",
    title: "La réponse s’affiche",
    text: "Les tokens sont reconvertis en texte, parfois affiché au fur et à mesure. La génération peut s’arrêter sur un token de fin ou une limite fixée par l’application. Ici, la réponse a été écrite à l’avance. Une réponse plausible peut être inexacte : vérifiez les informations importantes.",
    note: "Un arrêt de la génération ne signifie pas que le modèle sait sa réponse complète ou correcte.",
  },
];

export const INTRO_TITLE = "Comment une IA répond à un message";
export const INTRO_TEXT = "Six scènes pour comprendre, pas à pas et sans prérequis, ce qui se passe entre votre message et la réponse d’un modèle de langage. Cette découverte ne délivre ni note, ni compétence, ni certificat.";
