import React, { useEffect, useId, useState } from "react";
import { Check, Pencil, Save } from "lucide-react";
import { ResetButton, btnCls, primaryCls } from "@/pages/admin/site/fields";

// Suivi des modifications commun (Contenu produits, Pages, Articles, FAQ).
// Référence = dernière version enregistrée ; copie de travail en mémoire uniquement (aucun historique).
const norm = (v) => (v === undefined || v === null || v === "" ? null : v);
export const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
export const CONFIRM_DISCARD = "Des modifications ne sont pas enregistrées. Les abandonner ?";

// Éditeurs ayant des changements non enregistrés (pour confirmer avant de changer d'onglet).
const unsaved = new Map();
export const hasUnsaved = () => [...unsaved.values()].some((n) => n > 0);
export const confirmLeave = () => !hasUnsaved() || window.confirm(CONFIRM_DISCARD);

export function useEditSession(saved, keys, { startEditing = false, onPending, countOf } = {}) {
  const id = useId();
  const [editing, setEditing] = useState(startEditing);
  const [base, setBase] = useState(saved);
  const [draft, setDraft] = useState(saved);
  const sig = JSON.stringify(saved);
  // Nouvelle version enregistrée reçue du serveur → nouvelle référence (un simple rechargement identique ne touche pas la copie).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setBase(saved); setDraft(saved); }, [sig]);
  const changed = keys.filter((k) => !same(draft[k], base[k]));
  const n = countOf ? countOf(draft, base) : changed.length;
  const count = editing ? n : 0;
  useEffect(() => { unsaved.set(id, count); if (onPending) onPending(count); }, [id, count, onPending]);
  useEffect(() => () => unsaved.delete(id), [id]);
  return {
    editing, draft, base, changed, count,
    set: (k, v) => setDraft((d) => ({ ...d, [k]: v })),
    isChanged: (k) => editing && changed.includes(k),
    restore: (k) => setDraft((d) => ({ ...d, [k]: base[k] })),
    cancel: () => setDraft(base),
    // Après un enregistrement réussi : la version enregistrée devient immédiatement la référence.
    commit: (value = draft) => { setBase(value); setDraft(value); },
    start: () => setEditing(true),
    // Quitter l'édition : confirmation si des changements ne sont pas enregistrés. Retourne false si refusé.
    finish: () => {
      if (n && !window.confirm(CONFIRM_DISCARD)) return false;
      setDraft(base);
      setEditing(false);
      return true;
    },
  };
}

export const Modified = ({ show, testid }) =>
  show ? <span className="ml-2 text-xs text-[#D4A359]" data-testid={testid}>modifié</span> : null;

// « Annuler ce changement » = revenir à la dernière version enregistrée ; visible seulement pour un champ modifié en édition.
export const Restore = ({ show, onClick, testid }) => (show ? <ResetButton onClick={onClick} testid={testid} /> : null);

// Libellé + indicateurs pour un champ suivi.
export function TrackedLabel({ s, k, label, testid }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-[#2C332E]">{label}<Modified show={s.isChanged(k)} testid={`${testid}-modified-${k}`} /></span>
      <Restore show={s.isChanged(k)} onClick={() => s.restore(k)} testid={`${testid}-reset-${k}`} />
    </div>
  );
}

export function EditModeBar({ s, testid, what = "le contenu", onFinish }) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid={`${testid}-mode-bar`}>
      {s.editing
        ? <button type="button" onClick={() => { if (s.finish() && onFinish) onFinish(); }} className={btnCls} data-testid={`${testid}-finish-btn`}><Check className="h-3.5 w-3.5" /> Terminer</button>
        : <button type="button" onClick={s.start} className={primaryCls} data-testid={`${testid}-edit-btn`}><Pencil className="h-4 w-4" /> Modifier</button>}
      <span className="text-xs text-[#626D66]" data-testid={`${testid}-mode-label`}>{s.editing ? "Mode édition" : `Consultation — cliquez sur « Modifier » pour changer ${what}.`}</span>
    </div>
  );
}

// Enregistrer (X) / Annuler : uniquement en édition et s'il existe des changements en attente.
export function SaveButtons({ s, onSave, saving, testid, label }) {
  if (!s.count) return null;
  return (
    <>
      <button type="button" onClick={onSave} disabled={saving} className={primaryCls} data-testid={`${testid}-save-btn`}>
        <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : `${label || "Enregistrer"} (${s.count})`}
      </button>
      <button type="button" onClick={s.cancel} className={btnCls} data-testid={`${testid}-cancel-btn`}>Annuler les modifications</button>
    </>
  );
}

export const PendingBadge = ({ n, testid }) =>
  n > 0 ? <span className="text-[10px] font-medium text-[#D4A359]" data-testid={testid} title="Nombre de changements non enregistrés">{n} non enregistré{n > 1 ? "s" : ""}</span> : null;
