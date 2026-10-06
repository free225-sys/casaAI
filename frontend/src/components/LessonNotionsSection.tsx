import { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/discovery.css";
import { Notice } from "./ui";
import { adminService } from "../services/adminService";
import { ApiError } from "../services/apiClient";
import type { KnowledgeNodeReference, LessonKnowledgeNodes } from "../types/api";
import { adminRefusal } from "../utils/adminErrors";
import { allPages } from "../utils/pagination";

const STATUS_LABEL: Record<KnowledgeNodeReference["status"], string> = { PUBLISHED: "publiée", DRAFT: "brouillon", ARCHIVED: "archivée" };
const sameSet = (a: Iterable<string>, b: Iterable<string>) => { const x = [...a].sort(); const y = [...b].sort(); return x.length === y.length && x.every((id, i) => id === y[i]); };

type Message = { kind: "success" | "error" | "info"; text: string } | null;

/** Notions associées à une leçon. Enregistrement **distinct** de celui du texte de la leçon (deux opérations explicites), remplacement atomique côté
 * serveur avec révision opaque. Après un conflit, l'état serveur est relu mais la sélection locale est conservée : rien n'est renvoyé sans une action
 * consciente. Les contrôles aident, c'est le serveur qui décide des droits. */
export function LessonNotionsSection({ lessonId, onDirtyChange }: { lessonId?: string; onDirtyChange?: (dirty: boolean) => void }) {
  const [nodes, setNodes] = useState<KnowledgeNodeReference[] | undefined>(undefined);
  const [nodesError, setNodesError] = useState(false);
  const [nodesReload, setNodesReload] = useState(0);
  const [saved, setSaved] = useState<LessonKnowledgeNodes | undefined>(undefined);
  const [lessonError, setLessonError] = useState(false);
  const [lessonReload, setLessonReload] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [conflict, setConflict] = useState<LessonKnowledgeNodes | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    setNodesError(false);
    allPages(params => adminService.listKnowledgeNodes(params), 100).then(list => { if (active) setNodes(list); }).catch(() => { if (active) setNodesError(true); });
    return () => { active = false; };
  }, [lessonId, nodesReload]);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    setLessonError(false);
    adminService.getLessonKnowledgeNodes(lessonId).then(state => {
      if (!active) return;
      setSaved(state);
      setSelected(new Set(state.node_ids));
    }).catch(() => { if (active) setLessonError(true); });
    return () => { active = false; };
  }, [lessonId, lessonReload]);

  const dirty = saved !== undefined && !sameSet(selected, saved.node_ids);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const titleOf = useCallback((id: string) => nodes?.find(node => node.id === id)?.title ?? id, [nodes]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (nodes ?? []).filter(node => !needle || node.title.toLowerCase().includes(needle) || node.id.toLowerCase().includes(needle));
  }, [nodes, query]);
  const unknown = useMemo(() => [...selected].filter(id => nodes && !nodes.some(node => node.id === id)), [nodes, selected]);
  const nonPublic = useMemo(() => (nodes ?? []).filter(node => selected.has(node.id) && node.status !== "PUBLISHED"), [nodes, selected]);

  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const handleConflict = async (original: ApiError) => {
    try {
      const remote = await adminService.getLessonKnowledgeNodes(lessonId!);
      if (saved && remote.revision !== saved.revision) {
        setConflict(remote);
        setMessage(null);
      } else {
        // Même révision : ce n'est pas un changement concurrent des notions (par exemple un cours partagé non couvert). Le texte du serveur est affiché.
        setMessage({ kind: "error", text: `Enregistrement refusé par le serveur : ${original.detail} Rien n’a été modifié ; votre sélection est conservée.` });
      }
    } catch {
      setMessage({ kind: "error", text: `Le serveur a signalé un conflit (${original.detail}) mais l’état actuel n’a pas pu être relu. Votre sélection est conservée : réessayez dans un instant.` });
    }
  };

  const save = async () => {
    if (!lessonId || !saved) return;
    setSaving(true); setMessage(null);
    try {
      const result = await adminService.replaceLessonKnowledgeNodes(lessonId, { node_ids: [...selected].sort(), expected_revision: saved.revision });
      setSaved(result);
      setSelected(new Set(result.node_ids));
      setMessage({ kind: "success", text: "Notions enregistrées." });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await handleConflict(e);
      else if (e instanceof ApiError && e.status === 422) setMessage({ kind: "error", text: `Enregistrement refusé : ${e.detail && typeof e.detail === "string" ? e.detail : "une notion sélectionnée est introuvable."} Rien n’a été modifié ; actualisez le référentiel et vérifiez votre sélection.` });
      else if (e instanceof ApiError) setMessage({ kind: "error", text: adminRefusal(e, "save", "L’enregistrement des notions a échoué.") });
      else setMessage({ kind: "error", text: "L’enregistrement n’a pas pu être confirmé. Votre sélection est conservée : vous pouvez réessayer, un nouvel envoi identique est sans risque." });
    } finally {
      setSaving(false);
    }
  };

  const heading = <h2 id="lesson-notions">Notions de la découverte</h2>;
  if (!lessonId) {
    return <section className="panel" aria-labelledby="lesson-notions">{heading}<p className="editor-hint">Enregistrez d’abord la leçon pour lui associer des notions.</p></section>;
  }

  const diff = conflict && saved ? {
    added: conflict.node_ids.filter(id => !saved.node_ids.includes(id)),
    removed: saved.node_ids.filter(id => !conflict.node_ids.includes(id)),
  } : null;

  return (
    <section className="panel editor-panel" aria-labelledby="lesson-notions">
      {heading}
      <p className="editor-hint">Cet enregistrement est distinct de celui de la leçon. Une association n’affiche rien sur l’accueil tant que la notion, la leçon et son cours ne sont pas tous publiés.</p>

      {lessonError && <div role="alert" className="section-error"><p>Impossible de charger les notions de cette leçon. Aucune sélection n’a été modifiée.</p><button type="button" className="btn btn-secondary" onClick={() => setLessonReload(v => v + 1)}>Réessayer : notions de la leçon</button></div>}
      {nodesError && <div role="alert" className="section-error"><p>Impossible de charger le référentiel des notions. Votre sélection est conservée.</p><button type="button" className="btn btn-secondary" onClick={() => setNodesReload(v => v + 1)}>Réessayer : référentiel des notions</button></div>}
      {!lessonError && !saved && <p role="status" className="editor-hint">Chargement des notions…</p>}

      {conflict && diff && (
        <Notice kind="warning">
          <p><strong>Les notions de cette leçon ont changé pendant votre édition.</strong> Rechargez puis réessayez : votre sélection est conservée, rien n’a été enregistré.</p>
          <p>Ajoutées par un autre éditeur : {diff.added.length ? diff.added.map(titleOf).join(", ") : "aucune"}. Retirées par un autre éditeur : {diff.removed.length ? diff.removed.map(titleOf).join(", ") : "aucune"}.</p>
          <p className="ui-row">
            <button type="button" className="btn btn-secondary" onClick={() => { setSaved(conflict); setConflict(null); setMessage({ kind: "info", text: "État actuel rechargé ; votre sélection est conservée. Vérifiez-la puis enregistrez de nouveau." }); }}>Garder ma sélection sur l’état actuel</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setSaved(conflict); setSelected(new Set(conflict.node_ids)); setConflict(null); setMessage({ kind: "info", text: "Sélection remplacée par l’état actuel du serveur." }); }}>Reprendre l’état du serveur</button>
          </p>
        </Notice>
      )}

      {message && <Notice kind={message.kind === "error" ? "error" : message.kind === "success" ? "success" : "info"}>{message.text}</Notice>}

      {saved && nodes && (
        <>
          <div className="field">
            <label htmlFor="notion-search">Rechercher une notion</label>
            <input id="notion-search" type="search" value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          {nonPublic.length > 0 && <p className="editor-hint">Non publiées parmi votre sélection : {nonPublic.map(node => `${node.title} (${STATUS_LABEL[node.status]})`).join(", ")}. Elles restent associées mais n’apparaissent pas publiquement.</p>}
          {unknown.map(id => (
            <label key={id} className="choice"><input type="checkbox" checked onChange={() => toggle(id)} /><span><strong>Notion absente du référentiel chargé</strong> <span className="mono">{id}</span></span></label>
          ))}
          <fieldset className="choice-group">
            <legend>{selected.size} notion(s) sélectionnée(s) sur {nodes.length}</legend>
            {visible.length === 0 && <p className="editor-hint">Aucune notion ne correspond à la recherche.</p>}
            {visible.map(node => (
              <label key={node.id} className="choice">
                <input type="checkbox" checked={selected.has(node.id)} onChange={() => toggle(node.id)} />
                <span><strong>{node.title}</strong> <span className="admin-sub">({STATUS_LABEL[node.status]}) <span className="mono">{node.id}</span></span></span>
              </label>
            ))}
          </fieldset>
          <div className="form-foot notions-foot">
            <span className="admin-count">{dirty ? "Modifications non enregistrées" : "À jour"}</span>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty || conflict !== null}>{saving ? "Enregistrement…" : "Enregistrer les notions"}</button>
          </div>
        </>
      )}
    </section>
  );
}
