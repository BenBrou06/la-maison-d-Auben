import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFaq, adminSaveFaq } from "@/lib/api";
import { ListEditor, btnCls } from "@/pages/admin/site/fields";
import { useEditSession, EditModeBar, SaveButtons, PendingBadge, same } from "@/pages/admin/site/editTracking";

const ITEM = [
  { name: "question", label: "Question", type: "text" },
  { name: "answer", label: "Réponse", type: "textarea", rows: 3 },
];
const pick = ({ id, question, answer }) => ({ id, question, answer });

// Une question est modifiée si elle est nouvelle ou si son texte diffère de la version enregistrée.
const itemChanged = (it, base) => !it.id || !same(it, base.find((b) => b.id === it.id));
// Changements = questions modifiées/ajoutées + supprimées (+1 si seul l'ordre a changé).
const countChanges = (draft, base) => {
  const ids = new Set(draft.items.map((it) => it.id).filter(Boolean));
  const n = draft.items.filter((it) => itemChanged(it, base.items)).length + base.items.filter((it) => !ids.has(it.id)).length;
  return n || (same(draft.items, base.items) ? 0 : 1);
};

export default function FaqPanel() {
  const qc = useQueryClient();
  const { data = [], isSuccess } = useQuery({ queryKey: ["admin-faq"], queryFn: adminFaq });
  const saved = useMemo(() => ({ items: data.map(pick) }), [data]);
  const s = useEditSession(saved, ["items"], { countOf: countChanges });
  const items = s.draft.items;
  const [saving, setSaving] = useState(false);
  const setItems = (v) => s.set("items", v);

  const restoreItem = (i) => {
    const it = items[i];
    const prev = it.id && s.base.items.find((b) => b.id === it.id);
    setItems(prev ? items.map((x, k) => (k === i ? prev : x)) : items.filter((_, k) => k !== i));
  };

  const save = async () => {
    if (items.some((it) => !it.question.trim() || !it.answer.trim())) return toast.error("Chaque question doit avoir une réponse.");
    const removed = s.base.items.length - items.filter((it) => it.id).length;
    if (removed > 0 && !window.confirm(`${removed} question(s) seront supprimées définitivement. Continuer ?`)) return;
    setSaving(true);
    try {
      const res = await adminSaveFaq(items);
      toast.success("FAQ enregistrée.");
      if (Array.isArray(res)) s.commit({ items: res.map(pick) });
      qc.invalidateQueries({ queryKey: ["admin-faq"] });
      qc.invalidateQueries({ queryKey: ["faq"] });
    } catch (e) { toast.error(e.response?.data?.detail || "Enregistrement impossible."); }
    setSaving(false);
  };

  return (
    <div className="card-soft p-6" data-testid="faq-admin-panel">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">Questions fréquentes</h2>
        <PendingBadge n={s.count} testid="faq-pending" />
      </div>
      <p className="mb-5 mt-1 text-xs text-[#626D66]">Le titre et l'introduction de la page se modifient dans « Pages » → FAQ (page).</p>
      {isSuccess ? (
        <>
          <div className="mb-5"><EditModeBar s={s} testid="faq" what="les questions" /></div>
          <fieldset disabled={!s.editing}>
            <ListEditor value={items} item={ITEM} fixed={!s.editing} onChange={setItems} testid="faq-list" newItem={{ question: "", answer: "" }}
              isItemChanged={(i) => s.editing && itemChanged(items[i], s.base.items)} onRestoreItem={restoreItem} />
          </fieldset>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-[#E2DDD5] pt-4">
            <SaveButtons s={s} onSave={save} saving={saving} testid="faq" />
            <a href="/faq" target="_blank" rel="noopener noreferrer" className={btnCls} data-testid="faq-view-btn">Voir sur le site</a>
          </div>
        </>
      ) : <p className="text-sm text-[#626D66]">Chargement…</p>}
    </div>
  );
}
