import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { adminFaq, adminSaveFaq } from "@/lib/api";
import { ListEditor, primaryCls, btnCls } from "@/pages/admin/site/fields";

const ITEM = [
  { name: "question", label: "Question", type: "text" },
  { name: "answer", label: "Réponse", type: "textarea", rows: 3 },
];

export default function FaqPanel() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-faq"], queryFn: adminFaq });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => setItems(data.map(({ id, question, answer }) => ({ id, question, answer }))), [data]);
  const dirty = JSON.stringify(items) !== JSON.stringify(data.map(({ id, question, answer }) => ({ id, question, answer })));

  const save = async () => {
    if (items.some((it) => !it.question.trim() || !it.answer.trim())) return toast.error("Chaque question doit avoir une réponse.");
    const removed = data.length - items.filter((it) => it.id).length;
    if (removed > 0 && !window.confirm(`${removed} question(s) seront supprimées définitivement. Continuer ?`)) return;
    setSaving(true);
    try {
      await adminSaveFaq(items);
      toast.success("FAQ enregistrée.");
      qc.invalidateQueries({ queryKey: ["admin-faq"] });
      qc.invalidateQueries({ queryKey: ["faq"] });
    } catch (e) { toast.error(e.response?.data?.detail || "Enregistrement impossible."); }
    setSaving(false);
  };

  return (
    <div className="card-soft p-6" data-testid="faq-admin-panel">
      <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">Questions fréquentes</h2>
      <p className="mb-5 mt-1 text-xs text-[#626D66]">Le titre et l'introduction de la page se modifient dans « Pages » → FAQ (page).</p>
      <ListEditor value={items} item={ITEM} onChange={setItems} testid="faq-list" newItem={{ question: "", answer: "" }} />
      <div className="mt-5 flex flex-wrap gap-3 border-t border-[#E2DDD5] pt-4">
        <button onClick={save} disabled={!dirty || saving} className={primaryCls} data-testid="faq-save-btn"><Save className="h-4 w-4" /> Enregistrer</button>
        <button onClick={() => setItems(data.map(({ id, question, answer }) => ({ id, question, answer })))} disabled={!dirty} className={btnCls} data-testid="faq-cancel-btn">Annuler</button>
        <a href="/faq" target="_blank" rel="noopener noreferrer" className={btnCls} data-testid="faq-view-btn">Voir sur le site</a>
      </div>
    </div>
  );
}
