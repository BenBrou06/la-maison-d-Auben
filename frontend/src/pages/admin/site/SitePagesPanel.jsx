import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { adminContent, adminSaveContent, getProducts, mediaUrl } from "@/lib/api";
import { CONTENT_PAGES, defaultsFor } from "@/content/schema";
import { groupFields } from "@/content/adminLabels";
import { ImageInput, ListEditor, inputCls, btnCls } from "@/pages/admin/site/fields";
import { useEditSession, EditModeBar, TrackedLabel, SaveButtons, PendingBadge, CONFIRM_DISCARD, same } from "@/pages/admin/site/editTracking";

// Aperçu du logo commun : en-tête (44 px), onglet (16 px), mobile (32 px), avant enregistrement.
function FaviconPreview({ value }) {
  const src = value ? mediaUrl(value) : "/images/logo-176.png";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-[#FAF8F5] p-3 text-xs text-[#626D66]" data-testid="favicon-preview">
      <img src={src} alt="" className="h-11 w-11 rounded-lg object-contain" data-testid="logo-preview-header" />
      <span className="flex items-center gap-2 rounded-t-lg border border-b-0 border-[#E2DDD5] bg-white px-3 py-1.5 text-[#2C332E]">
        <img src={src} alt="" className="h-4 w-4 object-contain" data-testid="favicon-preview-16" /> La Maison d'Auben
      </span>
      <img src={src} alt="" className="h-8 w-8 rounded object-contain" data-testid="favicon-preview-32" />
      <span>{value ? "Nouveau logo (enregistrez pour l'appliquer à l'en-tête, au pied de page et au favicon)" : "Logo officiel"}</span>
    </div>
  );
}

function FieldInput({ f, value, onChange, products }) {
  const id = `content-field-${f.name}`;
  if (f.type === "list") return <ListEditor value={value} item={f.item} fixed={f.fixed} onChange={onChange} testid={id} />;
  if (f.type === "image") return (
    <>
      <ImageInput value={value} onChange={onChange} testid={id} />
      {f.name === "favicon" && <FaviconPreview value={value} />}
    </>
  );
  if (f.type === "product") return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} data-testid={id}>
      <option value="">Automatique (1er produit disponible)</option>
      {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}{p.purchasable ? "" : " — bientôt disponible"}</option>)}
    </select>
  );
  if (f.type === "textarea") return <textarea rows={f.rows || 3} value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} data-testid={id} />;
  return <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} data-testid={id} />;
}

function PageForm({ page, stored, products, onSaved, onPending }) {
  const effective = useMemo(() => ({ ...defaultsFor(page.key), ...(stored || {}) }), [page.key, stored]);
  const keys = useMemo(() => page.fields.map((f) => f.name), [page]);
  const s = useEditSession(effective, keys, { onPending });
  const { draft } = s;
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => groupFields(page), [page]);

  const save = async () => {
    setSaving(true);
    try {
      // Seuls les champs modifiés sont envoyés ; revenir à la valeur d'origine efface la surcharge.
      const fields = Object.fromEntries(page.fields.filter((f) => s.changed.includes(f.name)).map((f) => [f.name, same(draft[f.name], f.default) ? null : draft[f.name]]));
      await adminSaveContent(page.key, fields);
      toast.success("Contenu enregistré.");
      s.commit();
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || "Enregistrement impossible."); }
    setSaving(false);
  };

  return (
    <div className="space-y-5" data-testid={`content-page-form-${page.key}`}>
      {page.legal && (
        <p className="rounded-xl bg-[#FBF3E4] px-4 py-3 text-xs text-[#6B4E1F]">
          Page légale : le texte actuel est conservé tel quel tant que vous ne le modifiez pas. Ligne vide = nouveau paragraphe ; lignes commençant par « - » = liste ; lien : [texte](https://…).
        </p>
      )}
      <EditModeBar s={s} testid="content" />
      {groups.map((g) => (
        <fieldset key={g.title} disabled={!s.editing} className="space-y-4 rounded-2xl border border-[#E2DDD5] p-5" data-testid={`content-group-${g.title}`}>
          <legend className="px-2">
            <span className="font-serif text-base font-semibold text-[#1E3A2B]">{g.title}</span>
          </legend>
          {g.where && <p className="-mt-2 text-xs text-[#626D66]">Visible : {g.where}</p>}
          {g.fields.map((f) => (
            <div key={f.name}>
              <TrackedLabel s={s} k={f.name} label={f.uiLabel} testid="content" />
              <FieldInput f={f} value={draft[f.name]} onChange={(v) => s.set(f.name, v)} products={products} />
              {f.hint && <p className="mt-1 text-xs text-[#626D66]">{f.hint}</p>}
            </div>
          ))}
        </fieldset>
      ))}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-[#E2DDD5] bg-white py-4">
        <SaveButtons s={s} onSave={save} saving={saving} testid="content" />
        <a href={page.path} target="_blank" rel="noopener noreferrer" className={btnCls} data-testid="content-view-btn"><ExternalLink className="h-3.5 w-3.5" /> Voir sur le site</a>
      </div>
    </div>
  );
}

export default function SitePagesPanel() {
  const qc = useQueryClient();
  const { data: docs = [], isSuccess } = useQuery({ queryKey: ["admin-content"], queryFn: adminContent });
  const [pending, setPending] = useState(0);
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const [key, setKey] = useState(CONTENT_PAGES[0].key);
  const stored = docs.find((d) => d.key === key)?.fields;
  const page = CONTENT_PAGES.find((p) => p.key === key);
  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["admin-content"] });
    qc.invalidateQueries({ queryKey: ["site-content"] });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]" data-testid="site-pages-panel">
      <nav className="card-soft h-fit space-y-1 p-3">
        {CONTENT_PAGES.map((p) => {
          const n = p.key === key ? pending : 0;
          return (
            <button key={p.key} onClick={() => { if (p.key !== key && pending && !window.confirm(CONFIRM_DISCARD)) return; setPending(0); setKey(p.key); }} data-testid={`content-page-${p.key}`}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${key === p.key ? "bg-[#1E3A2B] text-[#FAF8F5]" : "text-[#2C332E] hover:bg-[#FAF8F5]"}`}>
              {p.label}<PendingBadge n={n} testid={`content-page-pending-${p.key}`} />
            </button>
          );
        })}
      </nav>
      <div className="card-soft p-6">
        <h2 className="mb-5 font-serif text-xl font-semibold text-[#1E3A2B]">{page.label}</h2>
        {isSuccess ? <PageForm key={key} page={page} stored={stored} products={products} onSaved={onSaved} onPending={setPending} /> : <p className="text-sm text-[#626D66]">Chargement…</p>}
      </div>
    </div>
  );
}
