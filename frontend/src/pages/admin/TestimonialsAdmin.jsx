import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2, Pencil, Plus, Star, BadgeCheck, Lock, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  adminTestimonials, adminTestimonialSettings, adminSaveTestimonial, adminDeleteTestimonial,
  adminReorderTestimonials, adminTestimonialStatus, adminReportsSeen, getProducts,
} from "@/lib/api";
import { ConfirmDeleteDialog } from "@/pages/admin/ConfirmDeleteDialog";
import { inputCls, labelCls, helpCls, move, IconBtn, Toggle } from "@/pages/admin/product/ui";

const primary = "rounded-lg bg-[#1E3A2B] px-4 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:opacity-50";
const STATUS = {
  pending: ["En attente", "bg-[#F6ECD9] text-[#A9772F]"],
  approved: ["À publier", "bg-[#E6EEF5] text-[#2F5A7A]"],
  published: ["Publié", "bg-[#EAF0EC] text-[#3B6B4C]"],
  rejected: ["Refusé", "bg-[#F7ECEA] text-[#8A2A1F]"],
};
const SOURCE = { form: "Formulaire du site", order: "Lien après achat", admin: "Ajouté par vous" };
const FILTERS = [["pending", "En attente"], ["approved", "À publier"], ["published", "Publiés"], ["rejected", "Refusés"], ["all", "Tous"]];
const ACTIONS = {
  pending: [["approved", "Valider", "Confirme que l'avis est authentique et autorisé à être publié"], ["rejected", "Refuser"]],
  approved: [["published", "Publier"], ["pending", "Remettre en attente"], ["rejected", "Refuser"]],
  published: [["approved", "Dépublier"], ["rejected", "Refuser"]],
  rejected: [["pending", "Réexaminer"]],
};
const NOTICE = {
  sent: "Avis refusé ; son auteur a reçu le motif par e-mail.",
  simulated: "Avis refusé ; e-mail du motif à l'auteur simulé (Preview).",
  no_email: "Avis refusé ; aucune adresse e-mail : l'auteur ne peut pas être informé.",
  already: "Avis refusé ; l'auteur a déjà été informé d'un refus pour cet avis (pas de nouvel e-mail).",
  skipped_abuse: "Avis refusé sans e-mail (adresse probablement usurpée).",
  limited: "Avis refusé ; cette adresse a déjà reçu un e-mail de refus il y a moins de 30 jours : pas de nouvel envoi.",
  failed: "Avis refusé, mais l'e-mail à l'auteur n'a pas pu partir.",
};
const ABUSE = ["spam", "impersonation"];
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const errMsg = (e, f) => { const d = e.response?.data?.detail; return typeof d === "string" ? d : f; };

function TestimonialForm({ initial, products, onDone }) {
  const [f, setF] = useState({ name: "", text: "", rating: null, kind: "brand", product_slug: "", email: "", authentic: false, source_note: "", experience_month: "",
    ...initial, kind: initial.kind || (initial.product_slug ? "product" : "brand") });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const { name, text, rating, kind, product_slug, email, authentic, source_note, experience_month } = f;
    try { await adminSaveTestimonial(initial.id, { name, text, rating: rating || null, kind, product_slug, email: email || "", authentic, source_note: source_note || "", experience_month: experience_month || "" }); toast.success("Témoignage enregistré."); onDone(); }
    catch (e) { toast.error(errMsg(e, "Nom et texte sont obligatoires.")); }
  };
  return (
    <div className="space-y-3 rounded-lg border border-[#CBD9CE] bg-[#FAF8F5] p-4" data-testid="testimonial-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Nom ou pseudonyme affiché</label><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} data-testid="testimonial-name" /></div>
        <div><label className={labelCls}>Adresse e-mail du déposant (privée)</label><input className={inputCls} value={f.email || ""} onChange={(e) => set("email", e.target.value)} data-testid="testimonial-email" /></div>
        <div><label className={labelCls}>Type de témoignage</label>
          <select className={inputCls} value={f.kind} disabled={!!initial.verified_purchase} onChange={(e) => set("kind", e.target.value)} data-testid="testimonial-kind">
            <option value="product">Avis sur un produit</option><option value="brand">Avis sur La Maison d'Auben</option>
          </select></div>
        {f.kind === "product" && <div><label className={labelCls}>Produit associé</label>
          <select className={inputCls} value={f.product_slug} disabled={!!initial.verified_purchase} title={initial.verified_purchase ? "Produit de la commande (achat vérifié)" : undefined} onChange={(e) => set("product_slug", e.target.value)} data-testid="testimonial-product">
            <option value="">Choisissez…</option>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select></div>}
        <div><label className={labelCls}>Note donnée par le client</label>
          <select className={inputCls} value={f.rating || ""} onChange={(e) => set("rating", e.target.value ? Number(e.target.value) : null)} data-testid="testimonial-rating">
            <option value="">Aucune note</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </select></div>
        <div><label className={labelCls}>Date de l'expérience (mois)</label>
          <input type="month" className={inputCls} value={f.experience_month || ""} onChange={(e) => set("experience_month", e.target.value)} data-testid="testimonial-experience" />
          <p className={helpCls}>Affichée sur le site avec la date de publication.</p></div>
      </div>
      <div><label className={labelCls}>Texte du témoignage</label><textarea rows={4} className={inputCls} value={f.text} onChange={(e) => set("text", e.target.value)} data-testid="testimonial-text" /></div>
      <div><label className={labelCls}>Note interne (jamais affichée sur le site)</label><input className={inputCls} value={f.source_note || ""} onChange={(e) => set("source_note", e.target.value)} data-testid="testimonial-source" /></div>
      <Toggle checked={f.authentic} onChange={(v) => set("authentic", v)} label="Témoignage authentique, publication autorisée par son auteur" hint="Décocher retire l'avis du site et le remet en attente." testid="testimonial-authentic" />
      {!initial.id && <p className={helpCls}>Le témoignage sera créé « En attente » ; validez-le puis publiez-le depuis la liste.</p>}
      <div className="flex gap-2">
        <button type="button" className={primary} onClick={save} data-testid="testimonial-save">Enregistrer</button>
        <button type="button" className="rounded-lg border border-[#E2DDD5] px-4 py-2.5 text-sm" onClick={onDone} data-testid="testimonial-cancel">Annuler</button>
      </div>
    </div>
  );
}

function RejectDialog({ item, reasons, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const canNotify = !!item?.email && !item?.author_notified_at;
  const [notify, setNotify] = useState(false);
  const confirm = async () => {
    try {
      const r = await adminTestimonialStatus(item.id, { status: "rejected", reason, detail, notify });
      (r.notice === "failed" ? toast.error : toast.success)(NOTICE[r.notice] || "Avis refusé.");
      onDone();
    } catch (e) { toast.error(errMsg(e, "Échec du refus.")); }
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="reject-dialog">
        <DialogHeader>
          <DialogTitle>Refuser le témoignage de « {item?.name} »</DialogTitle>
          <DialogDescription>Un avis n'est jamais refusé parce qu'il est négatif ou critique. Le motif est conservé dans l'administration ; le dossier est anonymisé après 90 jours.</DialogDescription>
        </DialogHeader>
        <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="reject-reason">
          <option value="">Motif du refus…</option>
          {Object.entries(reasons).filter(([k]) => k !== "expired").map(([k, v]) => <option key={k} value={k}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
        </select>
        <textarea rows={3} className={inputCls} placeholder={reason === "other" ? "Précisez le motif (obligatoire)" : "Précision facultative, transmise à l'auteur"} value={detail} onChange={(e) => setDetail(e.target.value)} data-testid="reject-detail" />
        {!canNotify ? <p className={helpCls} data-testid="reject-notice-info">{item?.author_notified_at ? "L'auteur a déjà été informé d'un refus pour cet avis : pas de nouvel e-mail." : "Aucune adresse e-mail : l'auteur ne peut pas être informé."}</p>
          : ABUSE.includes(reason)
            ? <Toggle checked={notify} onChange={setNotify} label="Envoyer quand même le motif par e-mail" hint="Pour un spam ou une usurpation, l'adresse appartient souvent à quelqu'un d'autre : par défaut, aucun e-mail n'est envoyé." testid="reject-notify" />
            : <p className={helpCls} data-testid="reject-notice-info">Le motif sera envoyé à l'auteur par e-mail (obligation légale) : un seul e-mail par avis, et au plus un par adresse sur 30 jours.</p>}
        <DialogFooter>
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-[#626D66] hover:bg-[#FAF8F5]" data-testid="reject-cancel">Annuler</button>
          <button onClick={confirm} disabled={!reason || (reason === "other" && !detail.trim())} data-testid="reject-submit"
            className="rounded-xl bg-[#8A2A1F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6F2118] disabled:cursor-not-allowed disabled:opacity-50">Refuser l'avis</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ t, i, items, products, reasons, reportReasons, onEdit, onReject, onDelete, refresh }) {
  const [label, cls] = STATUS[t.status];
  const reorder = async (dir) => { await adminReorderTestimonials(move(items, i, dir).map((x) => x.id)); refresh(); };
  const setStatus = async (status) => {
    if (status === "rejected") return onReject(t);
    try { await adminTestimonialStatus(t.id, { status }); toast.success(`Statut : ${STATUS[status][0]}.`); refresh(); }
    catch (e) { toast.error(errMsg(e, "Changement de statut impossible.")); }
  };
  const anon = !!t.anonymized_at;
  return (
    <div className="rounded-lg border border-[#E2DDD5] p-4" data-testid={`testimonial-row-${t.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${cls}`} data-testid={`testimonial-status-${t.id}`}>{label}</span>
        <span className="rounded-full bg-[#F2EDE4] px-2.5 py-0.5 text-[#626D66]" data-testid={`testimonial-source-${t.id}`}>{SOURCE[t.source] || SOURCE.admin}</span>
        {t.verified_purchase && <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF0EC] px-2.5 py-0.5 text-[#3B6B4C]"><BadgeCheck className="h-3 w-3" /> Achat vérifié</span>}
        <span className="text-[#87A987]">{t.kind === "product" ? products.find((p) => p.slug === t.product_slug)?.name || t.product_slug : "La Maison d'Auben"} · reçu le {day(t.created_at)}</span>
      </div>
      <p className="mt-2 font-medium text-[#1E3A2B]">{t.name} {t.rating && <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-[#A9772F]"><Star className="h-3 w-3 fill-current" />{t.rating}/5</span>}</p>
      {t.email && <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#626D66]" data-testid={`testimonial-email-${t.id}`}><Lock className="h-3 w-3" /> {t.email} (privé)</p>}
      <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-[#2C332E]">{anon ? "Contenu anonymisé (durée de conservation écoulée)." : t.text}</p>
      {t.source_note && <p className="mt-1 text-xs italic text-[#626D66]">Note interne : {t.source_note}</p>}
      {t.status === "rejected" && t.rejection_reason && <p className="mt-1 text-xs text-[#8A2A1F]">Motif : {reasons[t.rejection_reason]}{t.rejection_detail ? ` — ${t.rejection_detail}` : ""}{t.author_notified_at ? " · auteur informé" : ""}</p>}
      {t.purge_at && <p className="mt-1 text-xs text-[#87A987]">Anonymisation automatique le {day(t.purge_at)} s'il n'est pas publié.</p>}
      {t.status === "published" && t.unpublish_at && <p className="mt-1 text-xs text-[#87A987]" data-testid={`testimonial-retention-${t.id}`}>Publié le {day(t.published_at)} · e-mail effacé le {t.email_purge_at ? day(t.email_purge_at) : "(déjà effacé)"} · retrait automatique le {day(t.unpublish_at)}.</p>}
      {t.author_notice && t.status === "rejected" && <p className="mt-1 text-xs text-[#626D66]">{NOTICE[t.author_notice]}</p>}
      {(t.reports || []).length > 0 && (
        <div className="mt-2 rounded-lg bg-[#FBF3E6] p-3 text-xs text-[#7A5520]" data-testid={`testimonial-reports-${t.id}`}>
          <p className="flex items-center gap-1 font-semibold"><Flag className="h-3 w-3" /> Signalé {t.reports.length} fois{t.new_reports ? ` (${t.new_reports} nouveau${t.new_reports > 1 ? "x" : ""})` : ""}</p>
          <ul className="mt-1 space-y-0.5">{t.reports.slice(-3).map((r, k) => <li key={k}>{day(r.at)} — {reportReasons[r.reason]}{r.message ? ` : « ${r.message} »` : ""}</li>)}</ul>
          {t.new_reports > 0 && <button type="button" onClick={async () => { await adminReportsSeen(t.id); refresh(); }} className="mt-1 underline" data-testid={`testimonial-reports-seen-${t.id}`}>Marquer comme examinés</button>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!anon && ACTIONS[t.status].map(([s, lbl, hint]) => (
          <button key={s} type="button" title={hint} onClick={() => setStatus(s)} data-testid={`testimonial-action-${s}-${t.id}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${s === "rejected" ? "border border-[#E7C9C4] text-[#8A2A1F] hover:bg-[#F7ECEA]" : s === "published" || (s === "approved" && t.status === "pending") ? "bg-[#1E3A2B] text-white hover:bg-[#3B6B4C]" : "border border-[#E2DDD5] text-[#1E3A2B] hover:bg-[#EAF0EC]"}`}>{lbl}</button>
        ))}
        <span className="flex-1" />
        <IconBtn onClick={() => reorder(-1)} title="Monter" testid={`testimonial-up-${i}`}><ArrowUp className="h-4 w-4" /></IconBtn>
        <IconBtn onClick={() => reorder(1)} title="Descendre" testid={`testimonial-down-${i}`}><ArrowDown className="h-4 w-4" /></IconBtn>
        {!anon && <IconBtn onClick={onEdit} title="Modifier" testid={`testimonial-edit-${i}`}><Pencil className="h-4 w-4" /></IconBtn>}
        <IconBtn danger onClick={() => onDelete(t)} title="Supprimer définitivement" testid={`testimonial-delete-${i}`}><Trash2 className="h-4 w-4" /></IconBtn>
      </div>
    </div>
  );
}

export function TestimonialsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-testimonials"], queryFn: adminTestimonials });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); qc.invalidateQueries({ queryKey: ["testimonials"] }); };
  if (!data) return null;
  const st = data.settings;
  const all = data.items;
  const count = (s) => all.filter((t) => t.status === s).length;
  const active = filter || (count("pending") ? "pending" : "all");
  const items = active === "all" ? all : all.filter((t) => t.status === active);
  const saveSettings = async (patch) => {
    qc.setQueryData(["admin-testimonials"], (d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    await adminTestimonialSettings({ ...st, ...patch }); refresh(); toast.success("Réglage enregistré.");
  };
  const del = async (typed) => {
    try { await adminDeleteTestimonial(deleting.id, typed); toast.success("Témoignage supprimé définitivement."); setDeleting(null); refresh(); }
    catch (e) { toast.error(errMsg(e, "Échec de la suppression.")); }
  };
  const published = count("published");
  return (
    <div className="rounded-xl border border-[#E2DDD5] bg-white p-5" data-testid="testimonials-admin">
      <h3 className="font-serif text-lg text-[#1E3A2B]">Témoignages clients</h3>
      <p className="mt-2 rounded-lg bg-[#EAF0EC] px-3 py-2 text-xs text-[#3B6B4C]" data-testid="testimonials-visibility">
        {!st.enabled ? "Espace désactivé : rien n'est affiché sur le site." : published ? `${published} témoignage(s) publié(s) et visible(s) sur le site.` : "Espace activé, mais aucun témoignage publié : rien n'est affiché sur le site."}
        {" "}Seuls les avis « Publié » apparaissent ; l'e-mail et la note interne ne sont jamais affichés.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Toggle checked={st.enabled} onChange={(v) => saveSettings({ enabled: v })} label="Afficher les témoignages" testid="testimonials-enabled" />
        <Toggle checked={st.show_home} onChange={(v) => saveSettings({ show_home: v })} label="Sur la page d'accueil" testid="testimonials-home" />
        <Toggle checked={st.show_products} onChange={(v) => saveSettings({ show_products: v })} label="Sur les fiches produits" hint="Ceux du produit et ceux de la marque." testid="testimonials-products" />
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5" role="tablist" data-testid="testimonial-filters">
        {FILTERS.map(([k, lbl]) => (
          <button key={k} type="button" role="tab" aria-selected={active === k} onClick={() => setFilter(k)} data-testid={`testimonial-filter-${k}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${active === k ? "bg-[#1E3A2B] text-white" : "bg-[#F2EDE4] text-[#2C332E] hover:bg-[#EAF0EC]"}`}>
            {lbl} ({k === "all" ? all.length : count(k)})
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {editing === "new" && <TestimonialForm initial={{}} products={products} onDone={() => { setEditing(null); refresh(); }} />}
        {items.map((t) => (editing === t.id
          ? <TestimonialForm key={t.id} initial={t} products={products} onDone={() => { setEditing(null); refresh(); }} />
          : <Row key={t.id} t={t} i={all.indexOf(t)} items={all} products={products} reasons={data.reasons} reportReasons={data.report_reasons} onEdit={() => setEditing(t.id)} onReject={setRejecting} onDelete={setDeleting} refresh={refresh} />))}
        {!items.length && editing !== "new" && <p className={helpCls} data-testid="testimonials-empty">Aucun témoignage dans cette catégorie.</p>}
      </div>
      {editing !== "new" && (
        <button type="button" onClick={() => setEditing("new")} data-testid="testimonial-add" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-2 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
          <Plus className="h-4 w-4" /> Ajouter un témoignage
        </button>
      )}
      <RejectDialog key={rejecting?.id || "none"} item={rejecting} reasons={data.reasons} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); refresh(); }} />
      <ConfirmDeleteDialog open={!!deleting} title={`Supprimer le témoignage de « ${deleting?.name} »`} testid="testimonial-delete"
        description="Le témoignage et toutes les données associées (dont l'adresse e-mail) seront effacés, par exemple à la demande de son auteur."
        onCancel={() => setDeleting(null)} onConfirm={del} />
    </div>
  );
}
