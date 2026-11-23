import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2, Pencil, Plus, Star } from "lucide-react";
import {
  adminReassurance, adminSaveReassurance, adminTestimonials, adminTestimonialSettings,
  adminSaveTestimonial, adminDeleteTestimonial, adminReorderTestimonials, getProducts,
} from "@/lib/api";
import { inputCls, labelCls, helpCls, move, IconBtn, AddBtn, IconSelect, Toggle } from "@/pages/admin/product/ui";

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

const EMPTY = { name: "", text: "", rating: null, product_slug: "", authentic: false, published: false, source_note: "" };

function TestimonialForm({ initial, products, onDone }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    try { await adminSaveTestimonial(initial.id, { ...f, rating: f.rating || null }); toast.success("Témoignage enregistré."); onDone(); }
    catch (e) { const d = e.response?.data?.detail; toast.error(typeof d === "string" ? d : "Nom et texte sont obligatoires."); }
  };
  return (
    <div className="space-y-3 rounded-lg border border-[#CBD9CE] bg-[#FAF8F5] p-4" data-testid="testimonial-form">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={labelCls}>Nom ou prénom affiché</label><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} data-testid="testimonial-name" /></div>
        <div><label className={labelCls}>Concerne</label>
          <select className={inputCls} value={f.product_slug} onChange={(e) => set("product_slug", e.target.value)} data-testid="testimonial-product">
            <option value="">La marque (toutes les pages)</option>
            {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select></div>
        <div><label className={labelCls}>Note donnée par le client</label>
          <select className={inputCls} value={f.rating || ""} onChange={(e) => set("rating", e.target.value ? Number(e.target.value) : null)} data-testid="testimonial-rating">
            <option value="">Aucune note</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </select></div>
      </div>
      <div><label className={labelCls}>Texte du témoignage (tel que transmis)</label><textarea rows={3} className={inputCls} value={f.text} onChange={(e) => set("text", e.target.value)} data-testid="testimonial-text" /></div>
      <div><label className={labelCls}>Note interne (jamais affichée) : origine, date de l'accord…</label><input className={inputCls} value={f.source_note} onChange={(e) => set("source_note", e.target.value)} data-testid="testimonial-source" /></div>
      <Toggle checked={f.authentic} onChange={(v) => setF((x) => ({ ...x, authentic: v, published: v && x.published }))} label="Témoignage authentique, publication autorisée par son auteur" hint="Obligatoire pour pouvoir le publier." testid="testimonial-authentic" />
      <Toggle checked={f.published} onChange={(v) => f.authentic && set("published", v)} label="Publier sur le site" hint={f.authentic ? "" : "Cochez d'abord la case d'authenticité."} testid="testimonial-published" />
      <div className="flex gap-2">
        <button type="button" className={primary} onClick={save} data-testid="testimonial-save">Enregistrer</button>
        <button type="button" className="rounded-lg border border-[#E2DDD5] px-4 py-2.5 text-sm" onClick={onDone} data-testid="testimonial-cancel">Annuler</button>
      </div>
    </div>
  );
}

function TestimonialRow({ t, i, items, products, onEdit, refresh }) {
  const reorder = async (dir) => { await adminReorderTestimonials(move(items, i, dir).map((x) => x.id)); refresh(); };
  const del = async () => {
    if (!window.confirm(`Supprimer définitivement le témoignage de « ${t.name} » ?`)) return;
    await adminDeleteTestimonial(t.id); toast.success("Témoignage supprimé."); refresh();
  };
  const visible = t.authentic && t.published;
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-[#E2DDD5] p-3" data-testid={`testimonial-row-${i}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#1E3A2B]">{t.name} {t.rating && <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-[#A9772F]"><Star className="h-3 w-3 fill-current" />{t.rating}/5</span>}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-[#626D66]">{t.text}</p>
        <p className="mt-1 text-xs text-[#87A987]">{t.product_slug ? products.find((p) => p.slug === t.product_slug)?.name || t.product_slug : "Marque"} · <span className={visible ? "text-[#3B6B4C]" : "text-[#A9772F]"} data-testid={`testimonial-state-${i}`}>{visible ? "Publié" : t.authentic ? "Non publié" : "Authenticité non confirmée"}</span></p>
      </div>
      <IconBtn onClick={() => reorder(-1)} title="Monter" testid={`testimonial-up-${i}`}><ArrowUp className="h-4 w-4" /></IconBtn>
      <IconBtn onClick={() => reorder(1)} title="Descendre" testid={`testimonial-down-${i}`}><ArrowDown className="h-4 w-4" /></IconBtn>
      <IconBtn onClick={onEdit} title="Modifier" testid={`testimonial-edit-${i}`}><Pencil className="h-4 w-4" /></IconBtn>
      <IconBtn danger onClick={del} title="Supprimer" testid={`testimonial-delete-${i}`}><Trash2 className="h-4 w-4" /></IconBtn>
    </div>
  );
}

function TestimonialsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-testimonials"], queryFn: adminTestimonials });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const [editing, setEditing] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); qc.invalidateQueries({ queryKey: ["testimonials"] }); };
  if (!data) return null;
  const st = data.settings;
  const items = data.items;
  const saveSettings = async (patch) => { await adminTestimonialSettings({ ...st, ...patch }); refresh(); toast.success("Réglage enregistré."); };
  const published = items.filter((t) => t.authentic && t.published).length;
  return (
    <div className="rounded-xl border border-[#E2DDD5] bg-white p-5" data-testid="testimonials-admin">
      <h3 className="font-serif text-lg text-[#1E3A2B]">Témoignages clients</h3>
      <p className="mt-2 rounded-lg bg-[#EAF0EC] px-3 py-2 text-xs text-[#3B6B4C]" data-testid="testimonials-visibility">
        {!st.enabled ? "Espace désactivé : rien n'est affiché sur le site." : published ? `${published} témoignage(s) publié(s) et visible(s) sur le site.` : "Espace activé, mais aucun témoignage publié : rien n'est affiché sur le site."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Toggle checked={st.enabled} onChange={(v) => saveSettings({ enabled: v })} label="Afficher les témoignages" testid="testimonials-enabled" />
        <Toggle checked={st.show_home} onChange={(v) => saveSettings({ show_home: v })} label="Sur la page d'accueil" testid="testimonials-home" />
        <Toggle checked={st.show_products} onChange={(v) => saveSettings({ show_products: v })} label="Sur les fiches produits" hint="Ceux du produit et ceux de la marque." testid="testimonials-products" />
      </div>
      <div className="mt-4 space-y-2">
        {items.map((t, i) => (editing === t.id
          ? <TestimonialForm key={t.id} initial={t} products={products} onDone={() => { setEditing(null); refresh(); }} />
          : <TestimonialRow key={t.id} t={t} i={i} items={items} products={products} onEdit={() => setEditing(t.id)} refresh={refresh} />))}
        {!items.length && editing !== "new" && <p className={helpCls}>Aucun témoignage pour l'instant. N'ajoutez que de vrais avis transmis par vos clients.</p>}
        {editing === "new" && <TestimonialForm initial={{}} products={products} onDone={() => { setEditing(null); refresh(); }} />}
      </div>
      {editing !== "new" && (
        <button type="button" onClick={() => setEditing("new")} data-testid="testimonial-add" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-2 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
          <Plus className="h-4 w-4" /> Ajouter un témoignage
        </button>
      )}
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
