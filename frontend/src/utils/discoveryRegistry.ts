import type { DiscoveryLinks } from "../types/api";

/** Registre de la découverte « llm-answer », version 1 (contrat DISCOVERY_V1 §2). Il ne contient que des clés de scène et des identifiants de
 * notions : aucun identifiant ni titre de cours ou de leçon n'est connu du frontend, les associations viennent du serveur. */
export const DISCOVERY_KEY = "llm-answer";
export const REGISTRY_VERSION = 1;

export const SCENE_REGISTRY = [
  { key: "message", notions: ["llm"] },
  { key: "tokens", notions: ["tokenization"] },
  { key: "representations", notions: ["data-representation", "embeddings"] },
  { key: "model", notions: ["attention", "transformer"] },
  { key: "generation", notions: ["generation", "kv-cache"] },
  { key: "response", notions: ["llm", "generation"] },
] as const;

export type SceneKey = (typeof SCENE_REGISTRY)[number]["key"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string" && item !== "");
const isUnique = (items: string[]) => new Set(items).size === items.length;

/** Vérifie qu'une réponse est exactement du registre version 1 : version, clé de découverte, six clés de scène uniques dans l'ordre, structure des
 * métadonnées et des références, notions servies incluses dans celles du registre et dans son ordre. Retourne `null` si la réponse n'est pas
 * compatible : l'appelant affiche alors un état d'incompatibilité, jamais un état vide ni une donnée consommée à moitié. Une notion non publiée est
 * absente de la réponse : un sous-ensemble ordonné des notions du registre est donc compatible. */
export function validateDiscoveryLinks(data: unknown): DiscoveryLinks | null {
  if (!isRecord(data) || data.discovery_key !== DISCOVERY_KEY || data.registry_version !== REGISTRY_VERSION) return null;
  const { scenes, notions, courses } = data;
  if (!Array.isArray(scenes) || !Array.isArray(notions) || !Array.isArray(courses) || scenes.length !== SCENE_REGISTRY.length) return null;

  const notionIds: string[] = [];
  for (const notion of notions) {
    if (!isRecord(notion) || typeof notion.id !== "string" || notion.id === "" || typeof notion.title !== "string") return null;
    notionIds.push(notion.id);
  }
  const courseIds: string[] = [];
  for (const course of courses) {
    if (!isRecord(course) || typeof course.id !== "string" || course.id === "" || typeof course.title !== "string" || typeof course.school_id !== "string") return null;
    if (course.level !== null && typeof course.level !== "string") return null;
    if (course.duration_min !== null && typeof course.duration_min !== "number") return null;
    courseIds.push(course.id);
  }
  if (!isUnique(notionIds) || !isUnique(courseIds)) return null;

  for (let index = 0; index < SCENE_REGISTRY.length; index += 1) {
    const scene = scenes[index];
    const expected = SCENE_REGISTRY[index];
    if (!isRecord(scene) || scene.scene_key !== expected.key || !isStringList(scene.notion_ids) || !isStringList(scene.course_ids)) return null;
    if (!isUnique(scene.notion_ids) || !isUnique(scene.course_ids)) return null;
    // Sous-ensemble ordonné : chaque notion servie doit suivre l'ordre du registre.
    let cursor = 0;
    for (const id of scene.notion_ids) {
      const position = (expected.notions as readonly string[]).indexOf(id, cursor);
      if (position === -1 || !notionIds.includes(id)) return null;
      cursor = position + 1;
    }
    if (!scene.course_ids.every(id => courseIds.includes(id))) return null;
  }
  return data as unknown as DiscoveryLinks;
}
