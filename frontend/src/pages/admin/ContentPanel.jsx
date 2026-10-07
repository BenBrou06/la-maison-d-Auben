import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Pencil, ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown,
  ExternalLink, ImagePlus, FileText,
} from "lucide-react";
import { getProducts, adminUpdateProduct, adminUploadImage, mediaUrl } from "@/lib/api";

const ICON_OPTIONS = [
  "Wallet", "Plane", "Home", "Car", "TrendingUp", "Heart", "Backpack", "Dices",
  "Receipt", "PiggyBank", "Target", "Calendar", "BarChart3", "Sparkles", "Dumbbell",
  "MapPin", "Fuel", "Wrench", "Users", "Boxes", "ClipboardList", "Activity", "Luggage", "Compass",
];

const inputCls = "w-full rounded-lg border border-[#E2DDD5] bg-[#FAF8F5] px-3 py-2 text-sm text-[#1E3A2B] focus:border-[#87A987] focus:outline-none";
const labelCls = "block text-xs font-medium text-[#626D66] mb-1";

const move = (arr, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-[#E2DDD5] bg-white p-5">
      <h3 className="font-serif text-lg text-[#1E3A2B]">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

// Liste de chaînes simples (Contenu reçu, Compatibilité)
function StringList({ label, items, onChange, testid }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={inputCls} value={v}
              data-testid={`${testid}-${i}`}
              onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            />
            <IconBtn onClick={() => onChange(move(items, i, -1))} title="Monter"><ArrowUp className="h-4 w-4" /></IconBtn>
            <IconBtn onClick={() => onChange(move(items, i, 1))} title="Descendre"><ArrowDown className="h-4 w-4" /></IconBtn>
            <IconBtn danger onClick={() => onChange(items.filter((_, k) => k !== i))} title="Supprimer"><Trash2 className="h-4 w-4" /></IconBtn>
          </div>
        ))}
      </div>
      <AddBtn testid={`${testid}-add`} onClick={() => onChange([...items, ""])}>Ajouter</AddBtn>
    </div>
  );
}

function IconBtn({ children, onClick, danger, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${danger ? "border-[#E7C9C4] text-[#B4453A] hover:bg-[#F7ECEA]" : "border-[#E2DDD5] text-[#2C332E] hover:bg-[#EAF0EC]"}`}>
      {children}
    </button>
  );
}

function AddBtn({ children, onClick, testid }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-2 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
      <Plus className="h-4 w-4" /> {children}
    </button>
  );
}

function ContentEditor({ product, onBack }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    name: product.name || "",
    short_description: product.short_description || "",
    badge: product.badge || "",
    description: product.description || "",
    audience: product.audience || "",
    features: (product.features || []).map((f) => ({ icon: f.icon || "Sparkles", title: f.title || "", text: f.text || "" })),
    contents: [...(product.contents || [])],
    compatibility: [...(product.compatibility || [])],
    faq: (product.faq || []).map((f) => ({ q: f.q || "", a: f.a || "" })),
    gallery: (product.gallery || []).map((g, i) => ({ key: g.key || `slot-${i}`, caption: g.caption || "", storage_path: g.storage_path || "", url: g.url || "" })),
    seo: { title: product.seo?.title || "", description: product.seo?.description || "" },
    main_image: product.main_image || "",
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadTo = async (file, cb) => {
    if (!file) return;
    try {
      const res = await adminUploadImage(file);
      cb(res.path);
      toast.success("Image envoyée. Pensez à enregistrer.");
    } catch { toast.error("Échec de l'upload de l'image."); }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Mise à jour partielle au niveau des champs : n'affecte ni prix, ni statut, ni fichier.
      await adminUpdateProduct(product.slug, {
        name: form.name,
        short_description: form.short_description,
        badge: form.badge,
        description: form.description,
        audience: form.audience,
        features: form.features,
        contents: form.contents,
        compatibility: form.compatibility,
        faq: form.faq,
        gallery: form.gallery,
        seo: form.seo,
        main_image: form.main_image,
      });
      toast.success("Contenu enregistré !");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", product.slug] });
    } catch { toast.error("Échec de l'enregistrement."); }
    setSaving(false);
  };

  return (
    <div data-testid={`content-editor-${product.slug}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} data-testid="content-back-btn" className="inline-flex items-center gap-1.5 text-sm text-[#626D66] hover:text-[#1E3A2B]">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          <a href={`/boutique/${product.slug}`} target="_blank" rel="noreferrer" data-testid="content-preview-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2DDD5] bg-white px-4 py-2.5 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
            <ExternalLink className="h-4 w-4" /> Voir la page
          </a>
          <button onClick={save} disabled={saving} data-testid="content-save-btn"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A2B] px-5 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:opacity-70">
            <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-[#EAF0EC] px-4 py-2.5 text-xs text-[#3B6B4C]">
        L'édition du contenu ne modifie ni le prix, ni la disponibilité, ni le fichier (gérés dans l'onglet Produits).
      </p>

      <div className="mt-5 space-y-5">
        <Section title="En-tête">
          <div><label className={labelCls}>Titre du produit</label><input className={inputCls} value={form.name} data-testid="content-name" onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className={labelCls}>Accroche / sous-titre</label><input className={inputCls} value={form.short_description} data-testid="content-short-description" onChange={(e) => set("short_description", e.target.value)} /></div>
          <div><label className={labelCls}>Badge (optionnel)</label><input className={inputCls} value={form.badge} data-testid="content-badge" onChange={(e) => set("badge", e.target.value)} /></div>
          <div>
            <label className={labelCls}>Image principale</label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-[#E2DDD5] bg-[#F2EDE4]">
                {form.main_image ? <img src={mediaUrl(form.main_image)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[#A9772F]"><ImagePlus className="h-5 w-5" /></div>}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#E2DDD5] px-4 py-2.5 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
                <ImagePlus className="h-4 w-4" /> {form.main_image ? "Remplacer" : "Ajouter"}
                <input type="file" accept="image/*" className="hidden" data-testid="content-main-image" onChange={(e) => uploadTo(e.target.files[0], (p) => set("main_image", p))} />
              </label>
            </div>
          </div>
        </Section>

        <Section title="Présentation">
          <div><label className={labelCls}>Description principale</label><textarea rows={4} className={inputCls} value={form.description} data-testid="content-description" onChange={(e) => set("description", e.target.value)} /></div>
          <div><label className={labelCls}>Texte de présentation (à qui / pourquoi)</label><textarea rows={3} className={inputCls} value={form.audience} data-testid="content-audience" onChange={(e) => set("audience", e.target.value)} /></div>
        </Section>

        <Section title="Fonctionnalités">
          <div className="space-y-3">
            {form.features.map((f, i) => (
              <div key={i} className="rounded-lg border border-[#E2DDD5] p-3" data-testid={`content-feature-${i}`}>
                <div className="flex items-center gap-2">
                  <select className={`${inputCls} w-40`} value={f.icon} data-testid={`content-feature-icon-${i}`}
                    onChange={(e) => { const n = [...form.features]; n[i] = { ...n[i], icon: e.target.value }; set("features", n); }}>
                    {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <input className={inputCls} placeholder="Titre" value={f.title} data-testid={`content-feature-title-${i}`}
                    onChange={(e) => { const n = [...form.features]; n[i] = { ...n[i], title: e.target.value }; set("features", n); }} />
                  <IconBtn onClick={() => set("features", move(form.features, i, -1))} title="Monter"><ArrowUp className="h-4 w-4" /></IconBtn>
                  <IconBtn onClick={() => set("features", move(form.features, i, 1))} title="Descendre"><ArrowDown className="h-4 w-4" /></IconBtn>
                  <IconBtn danger onClick={() => set("features", form.features.filter((_, k) => k !== i))} title="Supprimer"><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
                <textarea rows={2} className={`${inputCls} mt-2`} placeholder="Texte" value={f.text} data-testid={`content-feature-text-${i}`}
                  onChange={(e) => { const n = [...form.features]; n[i] = { ...n[i], text: e.target.value }; set("features", n); }} />
              </div>
            ))}
          </div>
          <AddBtn testid="content-add-feature" onClick={() => set("features", [...form.features, { icon: "Sparkles", title: "", text: "" }])}>Ajouter une fonctionnalité</AddBtn>
        </Section>

        <Section title="Galerie d'images">
          <div className="grid gap-3 sm:grid-cols-2">
            {form.gallery.map((g, i) => (
              <div key={g.key || i} className="rounded-lg border border-[#E2DDD5] p-3" data-testid={`content-gallery-${i}`}>
                <div className="aspect-[16/11] overflow-hidden rounded-md border border-[#E2DDD5] bg-[#F2EDE4]">
                  {(g.storage_path || g.url)
                    ? <img src={g.url || mediaUrl(g.storage_path)} alt="" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-sm text-[#A9772F]">Capture à venir</div>}
                </div>
                <input className={`${inputCls} mt-2`} placeholder="Légende" value={g.caption} data-testid={`content-gallery-caption-${i}`}
                  onChange={(e) => { const n = [...form.gallery]; n[i] = { ...n[i], caption: e.target.value }; set("gallery", n); }} />
                <div className="mt-2 flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-2 text-xs font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
                    <ImagePlus className="h-4 w-4" /> {(g.storage_path || g.url) ? "Remplacer" : "Ajouter"}
                    <input type="file" accept="image/*" className="hidden" data-testid={`content-gallery-upload-${i}`}
                      onChange={(e) => uploadTo(e.target.files[0], (p) => { const n = [...form.gallery]; n[i] = { ...n[i], storage_path: p, url: "" }; set("gallery", n); })} />
                  </label>
                  <IconBtn onClick={() => set("gallery", move(form.gallery, i, -1))} title="Monter"><ArrowUp className="h-4 w-4" /></IconBtn>
                  <IconBtn onClick={() => set("gallery", move(form.gallery, i, 1))} title="Descendre"><ArrowDown className="h-4 w-4" /></IconBtn>
                  <IconBtn danger onClick={() => set("gallery", form.gallery.filter((_, k) => k !== i))} title="Supprimer"><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>
            ))}
          </div>
          <AddBtn testid="content-add-gallery" onClick={() => set("gallery", [...form.gallery, { key: `slot-${Date.now()}`, caption: "", storage_path: "" }])}>Ajouter une image</AddBtn>
        </Section>

        <Section title="Ce que vous recevez">
          <StringList label="Éléments inclus" items={form.contents} onChange={(v) => set("contents", v)} testid="content-contents" />
        </Section>

        <Section title="Compatibilité">
          <StringList label="Compatibilités" items={form.compatibility} onChange={(v) => set("compatibility", v)} testid="content-compatibility" />
        </Section>

        <Section title="FAQ">
          <div className="space-y-3">
            {form.faq.map((f, i) => (
              <div key={i} className="rounded-lg border border-[#E2DDD5] p-3" data-testid={`content-faq-${i}`}>
                <div className="flex items-center gap-2">
                  <input className={inputCls} placeholder="Question" value={f.q} data-testid={`content-faq-q-${i}`}
                    onChange={(e) => { const n = [...form.faq]; n[i] = { ...n[i], q: e.target.value }; set("faq", n); }} />
                  <IconBtn onClick={() => set("faq", move(form.faq, i, -1))} title="Monter"><ArrowUp className="h-4 w-4" /></IconBtn>
                  <IconBtn onClick={() => set("faq", move(form.faq, i, 1))} title="Descendre"><ArrowDown className="h-4 w-4" /></IconBtn>
                  <IconBtn danger onClick={() => set("faq", form.faq.filter((_, k) => k !== i))} title="Supprimer"><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
                <textarea rows={2} className={`${inputCls} mt-2`} placeholder="Réponse" value={f.a} data-testid={`content-faq-a-${i}`}
                  onChange={(e) => { const n = [...form.faq]; n[i] = { ...n[i], a: e.target.value }; set("faq", n); }} />
              </div>
            ))}
          </div>
          <AddBtn testid="content-add-faq" onClick={() => set("faq", [...form.faq, { q: "", a: "" }])}>Ajouter une question</AddBtn>
        </Section>

        <Section title="Référencement (SEO)">
          <div><label className={labelCls}>Titre SEO</label><input className={inputCls} value={form.seo.title} data-testid="content-seo-title" onChange={(e) => set("seo", { ...form.seo, title: e.target.value })} /></div>
          <div><label className={labelCls}>Meta description</label><textarea rows={2} className={inputCls} value={form.seo.description} data-testid="content-seo-description" onChange={(e) => set("seo", { ...form.seo, description: e.target.value })} /></div>
        </Section>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} data-testid="content-save-btn-bottom"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:opacity-70">
            <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer le contenu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContentPanel() {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const [editing, setEditing] = useState(null);
  const current = products.find((p) => p.slug === editing);

  return (
    <div className="card-soft overflow-hidden p-6" data-testid="content-panel">
      <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">Contenu</h2>
      {!current ? (
        <>
          <p className="mb-4 mt-1 text-sm text-[#626D66]">
            Gérez le contenu éditorial de chaque fiche produit (textes, fonctionnalités, galerie, FAQ, SEO). Les changements s'affichent immédiatement sur la page publique.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.slug} className="flex items-center gap-4 rounded-xl border border-[#E2DDD5] bg-white p-4" data-testid={`content-product-${p.slug}`}>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#E2DDD5] bg-[#F2EDE4]">
                  {p.main_image ? <img src={mediaUrl(p.main_image)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[#87A987]"><FileText className="h-5 w-5" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[#1E3A2B]">{p.name}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${p.purchasable ? "bg-[#EAF0EC] text-[#3B6B4C]" : "bg-[#F6ECD9] text-[#A9772F]"}`}>
                    {p.purchasable ? "Disponible" : "Bientôt disponible"}
                  </span>
                </div>
                <button onClick={() => setEditing(p.slug)} data-testid={`content-edit-${p.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A2B] px-3 py-2 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]">
                  <Pencil className="h-4 w-4" /> Modifier
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-2">
          <ContentEditor product={current} onBack={() => setEditing(null)} />
        </div>
      )}
    </div>
  );
}
