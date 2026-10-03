import { useEffect, useId, useRef, type ReactNode } from "react";

const statuses = {
  PUBLISHED: ["published", "Publié"], DRAFT: ["draft", "Brouillon"], ARCHIVED: ["draft", "Archivé"],
  COMPLETED: ["done", "Terminée"], IN_PROGRESS: ["progress", "En cours"], NOT_STARTED: ["draft", "À commencer"],
  UNAVAILABLE: ["unavailable", "Indisponible"],
} as const;
export function Status({ value }: { value: keyof typeof statuses }) {
  const [kind, label] = statuses[value];
  return <span className={`status status-${kind}`}>{label}</span>;
}
export function Notice({ kind = "error", children }: { kind?: "error" | "warning" | "success" | "info"; children: ReactNode }) {
  return <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}><div className="notice-content">{children}</div></div>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="segmented" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
export function Stepper({ current, labels }: { current: number; labels: readonly string[] }) {
  return <ol className="stepper" aria-label="Étapes de l’import">{labels.map((label, index) => <li key={label} className={index < current ? "is-done" : undefined} aria-current={index === current ? "step" : undefined} aria-label={`${index + 1}. ${label}${index < current ? ' : terminée' : ''}`}><span className="dot" aria-hidden="true">{index < current ? "✓" : index + 1}</span><span className="step-label">{label}</span></li>)}</ol>;
}
export function ConfirmDialog({ title, children, confirmLabel, busy, onConfirm, onCancel }: { title: string; children: ReactNode; confirmLabel: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="confirm-dialog" role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id={titleId}>{title}</h2><div id={descriptionId}>{children}</div>
    <div className="page-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Annuler</button><button type="button" className="btn btn-danger" disabled={busy} onClick={onConfirm}>{busy ? "Enregistrement…" : confirmLabel}</button></div>
  </dialog>;
}
