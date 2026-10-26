import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Save } from "lucide-react";
import { adminContent, adminSaveContent, getProducts } from "@/lib/api";
import { CONTENT_PAGES, defaultsFor } from "@/content/schema";
import { ImageInput, ListEditor, ResetButton, inputCls, primaryCls, btnCls } from "@/pages/admin/site/fields";

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function FieldInput({ f, value, onChange, products }) {
  const id = `content-field-${f.name}`;
  if (f.type === "list") return <ListEditor value={value} item={f.item} fixed={f.fixed} onChange={onChange} testid={id} />;
  if (f.type === "image") return <ImageInput value={value} onChange={onChange} testid={id} />;
  if (f.type === "product") return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} data-testid={id}>
      <option value="">Automatique (1er produit disponible)</option>
      {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}{p.purchasable ? "" : " — bientôt disponible"}</option>)}
    </select>
  );
  if (f.type === "textarea") return <textarea rows={f.rows || 3} value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} data-testid={id} />;
  return <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} data-testid={id} />;
}

function PageForm({ page, stored, products, onSaved, onDirty }) {
  const effective = useMemo(() => ({ ...defaultsFor(page.key), ...(stored || {}) }), [page.key, stored]);
  const [draft, setDraft] = useState(effective);
  const [saving, setSaving] = useState(false);
  const changed = page.fields.filter((f) => !same(draft[f.name], effective[f.name]));
  useEffect(() => onDirty(changed.length > 0), [changed.length, onDirty]);

  const save = async () => {
    setSaving(true);
    try {
      // Seuls les champs modifiés sont envoyés ; revenir à la valeur d'origine efface la surcharge.
      const fields = Object.fromEntries(changed.map((f) => [f.name, same(draft[f.name], f.default) ? null : draft[f.name]]));
      await adminSaveContent(page.key, fields);
      toast.success("Contenu enregistré.");
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
      {page.fields.map((f) => (
        <div key={f.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#2C332E]">{f.label}{!same(draft[f.name], effective[f.name]) && <span className="ml-2 text-xs text-[#D4A359]">modifié</span>}</span>
            {stored && f.name in stored && <ResetButton onClick={() => setDraft({ ...draft, [f.name]: f.default })} testid={`content-reset-${f.name}`} />}
          </div>
          <FieldInput f={f} value={draft[f.name]} onChange={(v) => setDraft({ ...draft, [f.name]: v })} products={products} />
        </div>
      ))}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-[#E2DDD5] bg-white py-4">
        <button onClick={save} disabled={!changed.length || saving} className={primaryCls} data-testid="content-save-btn">
          <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : `Enregistrer${changed.length ? ` (${changed.length})` : ""}`}
        </button>
        <button onClick={() => setDraft(effective)} disabled={!changed.length} className={btnCls} data-testid="content-cancel-btn">Annuler les modifications</button>
        <a href={page.path} target="_blank" rel="noopener noreferrer" className={btnCls} data-testid="content-view-btn"><ExternalLink className="h-3.5 w-3.5" /> Voir sur le site</a>
      </div>
    </div>
  );
}

export default function SitePagesPanel() {
  const qc = useQueryClient();
  const { data: docs = [], isSuccess } = useQuery({ queryKey: ["admin-content"], queryFn: adminContent });
  const [dirty, setDirty] = useState(false);
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
          const n = Object.keys(docs.find((d) => d.key === p.key)?.fields || {}).length;
          return (
            <button key={p.key} onClick={() => { if (p.key !== key && dirty && !window.confirm("Des modifications ne sont pas enregistrées. Les abandonner ?")) return; setDirty(false); setKey(p.key); }} data-testid={`content-page-${p.key}`}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${key === p.key ? "bg-[#1E3A2B] text-[#FAF8F5]" : "text-[#2C332E] hover:bg-[#FAF8F5]"}`}>
              {p.label}{n > 0 && <span className="text-[10px] opacity-70">{n} modif.</span>}
            </button>
          );
        })}
      </nav>
      <div className="card-soft p-6">
        <h2 className="mb-5 font-serif text-xl font-semibold text-[#1E3A2B]">{page.label}</h2>
        {isSuccess ? <PageForm key={key} page={page} stored={stored} products={products} onSaved={onSaved} onDirty={setDirty} /> : <p className="text-sm text-[#626D66]">Chargement…</p>}
      </div>
    </div>
  );
}
