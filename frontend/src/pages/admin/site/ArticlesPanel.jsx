import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, ExternalLink, Trash2 } from "lucide-react";
import { adminArticles, adminCreateArticle, adminUpdateArticle, adminDeleteArticle, getProducts } from "@/lib/api";
import { ImageInput, ListEditor, inputCls, primaryCls, btnCls } from "@/pages/admin/site/fields";
import { ConfirmDeleteDialog } from "@/pages/admin/ConfirmDeleteDialog";
import { useEditSession, EditModeBar, SaveButtons, Modified, Restore, PendingBadge, CONFIRM_DISCARD } from "@/pages/admin/site/editTracking";

const EMPTY = { title: "", slug: "", category: "", excerpt: "", cover_image: "", published_at: new Date().toISOString().slice(0, 10),
  read_time: 3, content: [], cta_text: "", related_product_slugs: [], published: false, seo_title: "", seo_description: "" };
const BLOCK = [
  { name: "type", label: "Type", type: "select", options: [{ value: "p", label: "Paragraphe" }, { value: "h2", label: "Titre de section" }] },
  { name: "text", label: "Texte", type: "textarea", rows: 4 },
];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const toForm = (a) => ({ ...EMPTY, ...a, published: a.published !== false, published_at: (a.published_at || "").slice(0, 10) });

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—");

function Field({ label, children, hint, modified, onRestore, testid }) {
  return (
    <label className="block text-sm font-medium text-[#2C332E]">
      <span className="flex items-center justify-between gap-3"><span>{label}<Modified show={modified} testid={`article-modified-${testid}`} />
      {hint && <span className="ml-2 text-xs font-normal text-[#626D66]">{hint}</span>}</span>
      <Restore show={modified} onClick={(e) => { e.preventDefault(); onRestore(); }} testid={`article-reset-${testid}`} /></span>
      <div className="mt-1.5 font-normal">{children}</div>
    </label>
  );
}

function ArticleForm({ article, products, onSaved, onDeleted, onPending }) {
  const isNew = !article;
  const initial = useMemo(() => (isNew ? EMPTY : toForm(article)), [article, isNew]);
  const s = useEditSession(initial, Object.keys(EMPTY), { startEditing: isNew, onPending });
  const f = s.draft;
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const m = (k) => !isNew && s.isChanged(k);
  const remove = async (word) => {
    try {
      await adminDeleteArticle(article.slug, word);
      toast.success(`Article « ${article.title} » supprimé.`);
      setConfirmDelete(false);
      onDeleted(article.slug);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Suppression impossible. L'article n'a pas été supprimé.");
    }
  };
  const set = (k) => (v) => s.set(k, v);
  const ev = (k) => (e) => set(k)(e.target.value);

  const save = async () => {
    const payload = {};
    for (const k of isNew ? Object.keys(EMPTY) : s.changed) payload[k] = f[k];
    if (payload.published_at) payload.published_at = new Date(payload.published_at).toISOString();
    if (payload.read_time !== undefined) payload.read_time = Number(payload.read_time) || 1;
    if (payload.content) payload.content = payload.content.filter((b) => b.text.trim()).map((b) => ({ type: b.type === "h2" ? "h2" : "p", text: b.text }));
    if (payload.slug && !SLUG_RE.test(payload.slug)) return toast.error("Slug invalide : lettres minuscules, chiffres et tirets uniquement.");
    if (!isNew && payload.slug && !window.confirm(`Changer l'adresse de l'article en /ressources/${payload.slug} ? L'ancienne adresse redirigera vers la nouvelle.`)) return;
    if (!Object.keys(payload).length) return;
    setSaving(true);
    try {
      const saved = isNew ? await adminCreateArticle(payload) : await adminUpdateArticle(article.slug, payload);
      toast.success("Article enregistré.");
      if (!isNew) s.commit();
      onSaved(saved.slug);
    } catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Enregistrement impossible."); }
    setSaving(false);
  };

  return (
    <div className="space-y-4" data-testid="article-form">
      {!isNew && (
        <dl className="grid gap-3 rounded-xl bg-[#FAF8F5] p-4 text-sm sm:grid-cols-3" data-testid="article-meta">
          <div><dt className="text-xs text-[#626D66]">Statut</dt><dd className="font-medium text-[#1E3A2B]" data-testid="article-meta-status">{article.published === false ? "Brouillon" : "Publié"}</dd></div>
          <div><dt className="text-xs text-[#626D66]">Date de publication</dt><dd className="font-medium text-[#1E3A2B]" data-testid="article-meta-published">{fmt(article.published_at)}</dd></div>
          <div><dt className="text-xs text-[#626D66]">Dernière modification enregistrée</dt><dd className="font-medium text-[#1E3A2B]" data-testid="article-meta-updated">{article.updated_at ? fmt(article.updated_at) : "Aucune depuis la création"}</dd></div>
        </dl>
      )}
      {!isNew && <EditModeBar s={s} testid="article" what="l'article" />}
      <fieldset disabled={!s.editing} className="space-y-4">
      <Field label="Titre" modified={m("title")} onRestore={() => s.restore("title")} testid="title"><input value={f.title} onChange={(e) => { s.set("title", e.target.value); if (isNew) s.set("slug", slugify(e.target.value)); }} className={inputCls} data-testid="article-title-input" /></Field>
      <Field label="Slug (adresse)" modified={m("slug")} onRestore={() => s.restore("slug")} testid="slug" hint={isNew ? "" : "changer le slug redirige l'ancienne adresse"}><input value={f.slug} onChange={ev("slug")} className={inputCls} data-testid="article-slug-input" /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Catégorie" modified={m("category")} onRestore={() => s.restore("category")} testid="category"><input value={f.category} onChange={ev("category")} className={inputCls} data-testid="article-category-input" /></Field>
        <Field label="Date de publication" modified={m("published_at")} onRestore={() => s.restore("published_at")} testid="published_at"><input type="date" value={f.published_at} onChange={ev("published_at")} className={inputCls} data-testid="article-date-input" /></Field>
        <Field label="Lecture (min)" modified={m("read_time")} onRestore={() => s.restore("read_time")} testid="read_time"><input type="number" min={1} max={120} value={f.read_time} onChange={ev("read_time")} className={inputCls} data-testid="article-readtime-input" /></Field>
      </div>
      <Field label="Extrait" modified={m("excerpt")} onRestore={() => s.restore("excerpt")} testid="excerpt"><textarea rows={2} value={f.excerpt} onChange={ev("excerpt")} className={inputCls} data-testid="article-excerpt-input" /></Field>
      <Field label="Image de couverture" modified={m("cover_image")} onRestore={() => s.restore("cover_image")} testid="cover_image"><ImageInput value={f.cover_image} onChange={set("cover_image")} testid="article-cover" /></Field>
      <Field label="Contenu" modified={m("content")} onRestore={() => s.restore("content")} testid="content" hint="blocs dans l'ordre d'affichage"><ListEditor value={f.content} item={BLOCK} onChange={set("content")} testid="article-blocks" fixed={!s.editing} newItem={{ type: "p", text: "" }} /></Field>
      <Field label="Texte du bandeau d'appel à l'action" modified={m("cta_text")} onRestore={() => s.restore("cta_text")} testid="cta_text" hint="affiché si un produit est associé"><input value={f.cta_text} onChange={ev("cta_text")} className={inputCls} data-testid="article-cta-input" /></Field>
      <Field label="Produits associés" modified={m("related_product_slugs")} onRestore={() => s.restore("related_product_slugs")} testid="related_product_slugs">
        <div className="flex flex-wrap gap-3" data-testid="article-products">
          {products.map((p) => (
            <label key={p.slug} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={f.related_product_slugs.includes(p.slug)} data-testid={`article-product-${p.slug}`}
                onChange={(e) => set("related_product_slugs")(e.target.checked ? [...f.related_product_slugs, p.slug] : f.related_product_slugs.filter((s) => s !== p.slug))} />
              {p.name}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre SEO" modified={m("seo_title")} onRestore={() => s.restore("seo_title")} testid="seo_title" hint="vide = titre de l'article"><input value={f.seo_title} onChange={ev("seo_title")} className={inputCls} data-testid="article-seo-title-input" /></Field>
        <Field label="Meta description" modified={m("seo_description")} onRestore={() => s.restore("seo_description")} testid="seo_description" hint="vide = extrait"><input value={f.seo_description} onChange={ev("seo_description")} className={inputCls} data-testid="article-seo-desc-input" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-[#2C332E]">
        <input type="checkbox" checked={f.published} onChange={(e) => set("published")(e.target.checked)} className="h-4 w-4 accent-[#3B6B4C]" data-testid="article-published-checkbox" />
        Publié (visible sur le site et dans le sitemap)
        <Modified show={m("published")} testid="article-modified-published" />
        <Restore show={m("published")} onClick={(e) => { e.preventDefault(); s.restore("published"); }} testid="article-reset-published" />
      </label>
      </fieldset>
      <div className="flex flex-wrap gap-3 border-t border-[#E2DDD5] pt-4">
        {isNew
          ? <button onClick={save} disabled={saving || !f.title.trim() || !f.slug.trim()} className={primaryCls} data-testid="article-save-btn"><Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Créer l'article"}</button>
          : <SaveButtons s={s} onSave={save} saving={saving} testid="article" />}
        {!isNew && f.published && <a href={`/ressources/${article.slug}`} target="_blank" rel="noopener noreferrer" className={btnCls} data-testid="article-view-btn"><ExternalLink className="h-3.5 w-3.5" /> Voir sur le site</a>}
        {!isNew && (
          <button type="button" onClick={() => setConfirmDelete(true)} className={`${btnCls} ml-auto text-[#8A2A1F]`} data-testid="article-delete-btn">
            <Trash2 className="h-3.5 w-3.5" /> Supprimer l'article
          </button>
        )}
      </div>
      {!isNew && (
        <ConfirmDeleteDialog
          open={confirmDelete} testid="delete-article"
          title={`Supprimer l'article « ${article.title} » ?`}
          description="L'article sera effacé de la base de données. Son adresse (et ses anciennes adresses) afficheront « Article introuvable » et il disparaîtra du sitemap. Les autres articles ne sont pas touchés."
          onCancel={() => setConfirmDelete(false)} onConfirm={remove}
        />
      )}
    </div>
  );
}

export default function ArticlesPanel() {
  const qc = useQueryClient();
  const { data: articles = [] } = useQuery({ queryKey: ["admin-articles"], queryFn: adminArticles });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const [sel, setSel] = useState(null);
  const [pending, setPending] = useState(0);
  const pick = (v) => { if (v !== sel && pending && !window.confirm(CONFIRM_DISCARD)) return; setPending(0); setSel(v); };
  const current = sel === "new" ? null : articles.find((a) => a.slug === sel) || articles[0];
  const onSaved = (slug) => {
    ["admin-articles", "articles", "article"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    setSel(slug);
  };
  const onDeleted = (slug) => {
    qc.setQueryData(["admin-articles"], (list = []) => list.filter((a) => a.slug !== slug));
    ["admin-articles", "articles", "article"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    setSel(null);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]" data-testid="articles-admin-panel">
      <div className="card-soft h-fit space-y-1 p-3">
        <button onClick={() => pick("new")} className={`${btnCls} mb-2 w-full justify-center`} data-testid="article-new-btn"><Plus className="h-3.5 w-3.5" /> Nouvel article</button>
        {articles.map((a) => (
          <button key={a.slug} onClick={() => pick(a.slug)} data-testid={`article-item-${a.slug}`}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${current?.slug === a.slug && sel !== "new" ? "bg-[#1E3A2B] text-[#FAF8F5]" : "text-[#2C332E] hover:bg-[#FAF8F5]"}`}>
            {a.title}
            <span className="block text-[10px] opacity-70">{a.published === false ? "Brouillon (non publié)" : "Publié"}</span>
            {current?.slug === a.slug && sel !== "new" && <PendingBadge n={pending} testid={`article-pending-${a.slug}`} />}
          </button>
        ))}
      </div>
      <div className="card-soft p-6">
        <h2 className="mb-5 font-serif text-xl font-semibold text-[#1E3A2B]">{sel === "new" ? "Nouvel article" : current?.title}</h2>
        {(sel === "new" || current)
          ? <ArticleForm key={sel === "new" ? "new" : current.slug} article={sel === "new" ? null : current} products={products} onSaved={onSaved} onDeleted={onDeleted} onPending={setPending} />
          : <p className="text-sm text-[#626D66]" data-testid="articles-empty">Aucun article. Cliquez sur « Nouvel article » pour en créer un.</p>}
      </div>
    </div>
  );
}
