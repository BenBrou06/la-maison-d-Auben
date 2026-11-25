import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { adminReassurance, adminSaveReassurance } from "@/lib/api";
import { TestimonialsAdmin } from "@/pages/admin/TestimonialsAdmin";
import { inputCls, helpCls, move, IconBtn, AddBtn, IconSelect, Toggle } from "@/pages/admin/product/ui";

const primary = "rounded-lg bg-[#1E3A2B] px-4 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:opacity-50";

function ReassuranceSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-reassurance"], queryFn: adminReassurance });
  const [items, setItems] = useState(null);
  useEffect(() => { if (data && !items) setItems(data.items); }, [data, items]);
  if (!items) return null;
  const upd = (i, patch) => { const n = [...items]; n[i] = { ...n[i], ...patch }; setItems(n); };
  const save = async () => {
    try { const r = await adminSaveReassurance(items); setItems(r.items); qc.invalidateQueries({ queryKey: ["admin-reassurance"] }); qc.invalidateQueries({ queryKey: ["product"] }); toast.success("Réassurance enregistrée."); }
    catch (e) { toast.error(e.response?.data?.detail || "Échec de l'enregistrement."); }
  };
  return (
    <div className="rounded-xl border border-[#E2DDD5] bg-white p-5" data-testid="reassurance-settings">
      <h3 className="font-serif text-lg text-[#1E3A2B]">Réassurance (toutes les fiches produits)</h3>
      <p className={`mt-1 ${helpCls}`}>Affichée sous le bouton d'achat (3 premiers intitulés) et dans un bandeau sous l'en-tête. N'activez que des engagements réellement tenus. Chaque fiche peut masquer un élément (Contenu produits › Réassurance).</p>
      <div className="mt-4 space-y-3">
        {items.map((it, i) => (
          <div key={it.key} className={`rounded-lg border p-3 ${it.enabled ? "border-[#CBD9CE]" : "border-[#E2DDD5] bg-[#FAF8F5] opacity-80"}`} data-testid={`reassurance-item-edit-${it.key}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Toggle checked={it.enabled} onChange={(v) => upd(i, { enabled: v })} label={it.enabled ? "Affiché" : "Masqué"} testid={`reassurance-enabled-${it.key}`} />
              <IconSelect value={it.icon} onChange={(v) => upd(i, { icon: v })} testid={`reassurance-icon-${it.key}`} />
              <input className={`${inputCls} min-w-[12rem] flex-1`} value={it.title} placeholder="Intitulé" onChange={(e) => upd(i, { title: e.target.value })} data-testid={`reassurance-title-${it.key}`} />
              <IconBtn onClick={() => setItems(move(items, i, -1))} title="Monter" testid={`reassurance-up-${it.key}`}><ArrowUp className="h-4 w-4" /></IconBtn>
              <IconBtn onClick={() => setItems(move(items, i, 1))} title="Descendre" testid={`reassurance-down-${it.key}`}><ArrowDown className="h-4 w-4" /></IconBtn>
              <IconBtn danger onClick={() => setItems(items.filter((_, k) => k !== i))} title="Supprimer" testid={`reassurance-delete-${it.key}`}><Trash2 className="h-4 w-4" /></IconBtn>
            </div>
            <textarea rows={2} className={`${inputCls} mt-2`} value={it.text} placeholder="Courte description" onChange={(e) => upd(i, { text: e.target.value })} data-testid={`reassurance-text-${it.key}`} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <AddBtn testid="reassurance-add" onClick={() => setItems([...items, { key: `custom-${Date.now()}`, enabled: false, icon: "ShieldCheck", title: "", text: "" }])}>Ajouter un élément</AddBtn>
        <button type="button" className={primary} onClick={save} data-testid="reassurance-save">Enregistrer la réassurance</button>
      </div>
    </div>
  );
}

export default function TrustPanel() {
  return (
    <div className="card-soft space-y-5 overflow-hidden p-6" data-testid="trust-panel">
      <div>
        <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">Confiance</h2>
        <p className="mt-1 text-sm text-[#626D66]">Les garanties affichées sur les fiches produits et les témoignages de vos clients.</p>
      </div>
      <ReassuranceSettings />
      <TestimonialsAdmin />
    </div>
  );
}
