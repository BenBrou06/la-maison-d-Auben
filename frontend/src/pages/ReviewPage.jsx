import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Heart, Package, Send, Star } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { getProducts, getReviewInvitation, submitReview } from "@/lib/api";
import { useContent, InlineText } from "@/lib/content";

const field = "w-full rounded-xl border border-[#E2DDD5] bg-white px-4 py-3 text-[#2C332E] placeholder-[#626D66]/60 focus:outline-none focus:ring-2 focus:ring-[#87A987]";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-3" data-testid="review-rating">
      <div className="flex" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Note facultative">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sur 5`} data-testid={`review-star-${n}`}
            onMouseEnter={() => setHover(n)} onClick={() => onChange(value === n ? null : n)} className="p-1 transition-transform duration-150 hover:scale-110">
            <Star className={`h-7 w-7 ${n <= (hover || value || 0) ? "fill-[#D4A359] text-[#D4A359]" : "text-[#CBD9CE]"}`} />
          </button>
        ))}
      </div>
      {value ? <button type="button" onClick={() => onChange(null)} className="text-xs text-[#626D66] underline" data-testid="review-rating-clear">Retirer la note</button>
        : <span className="text-xs text-[#87A987]">Facultatif</span>}
    </div>
  );
}

function KindChoice({ kind, setKind, c, locked }) {
  const opts = [["product", Package, c.product_label, c.product_text], ["brand", Heart, c.brand_label, c.brand_text]];
  return (
    <div className={`grid gap-3 ${locked ? "" : "sm:grid-cols-2"}`} role="radiogroup" aria-label="Catégorie du témoignage">
      {opts.filter(([k]) => !locked || k === "product").map(([k, Ico, label, text]) => (
        <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} data-testid={`review-kind-${k}`}
          className={`rounded-2xl border-2 p-4 text-left transition-[border-color,background-color] duration-200 ${kind === k ? "border-[#3B6B4C] bg-[#EAF0EC]" : "border-[#E2DDD5] bg-white hover:border-[#87A987]"}`}>
          <span className="flex items-center gap-2 font-medium text-[#1E3A2B]"><Ico className="h-4 w-4 text-[#3B6B4C]" /> {label}</span>
          <span className="mt-1 block text-xs text-[#626D66]">{text}</span>
        </button>
      ))}
    </div>
  );
}

const errorText = (e) => {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.some((x) => x.loc?.includes("email"))) return "Adresse e-mail invalide.";
  return "Une erreur est survenue. Réessayez dans un instant.";
};

export default function ReviewPage() {
  const c = useContent("avis");
  const [params] = useSearchParams();
  // Jeton gardé pour l'onglet (session) : un rechargement ne perd pas l'invitation, il n'apparaît plus dans l'adresse.
  const [token] = useState(() => {
    const t = params.get("invitation");
    if (t) sessionStorage.setItem("auben-review-invite", t);
    return t || (params.get("produit") ? "" : sessionStorage.getItem("auben-review-invite") || "");
  });
  const [kind, setKind] = useState(params.get("produit") || token ? "product" : "");
  const [form, setForm] = useState({ product_slug: params.get("produit") || "", name: "", email: "", rating: null, text: "", consent: false, website: "" });
  const [invite, setInvite] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const started = useRef(Date.now());
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname); // le jeton ne reste pas dans la barre d'adresse
    getReviewInvitation(token).then((d) => { setInvite(d); set("product_slug", d.product_slug); })
      .catch((e) => { sessionStorage.removeItem("auben-review-invite"); setInviteError(errorText(e)); });
  }, [token]);

  const useInvite = !!invite;
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!kind) return setError("Choisissez la catégorie de votre avis.");
    if (kind === "product" && !form.product_slug) return setError("Choisissez le produit concerné.");
    if (!form.name.trim()) return setError("Indiquez un nom ou un pseudonyme.");
    if (!useInvite && !EMAIL.test(form.email.trim())) return setError("Adresse e-mail invalide.");
    if (form.text.trim().length < 10) return setError("Votre témoignage est un peu court (10 caractères minimum).");
    if (!form.consent) return setError("Cochez la case autorisant la publication de votre témoignage.");
    setSending(true);
    try {
      await submitReview({ ...form, kind, email: useInvite ? null : form.email.trim(), invitation: useInvite ? token : "", elapsed_ms: Date.now() - started.current });
      setSent(true);
      sessionStorage.removeItem("auben-review-invite");
    } catch (err) { setError(errorText(err)); }
    setSending(false);
  };

  return (
    <>
      <Seo title={c.seo_title} description={c.seo_description} path="/donner-mon-avis" />
      <section className="container-app grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <span className="eyebrow">{c.eyebrow}</span>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl" data-testid="review-page-title">{c.title}</h1>
          <p className="mt-5 whitespace-pre-line text-[#626D66]">{c.intro}</p>
          {invite && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#EAF0EC] px-4 py-2 text-sm font-medium text-[#3B6B4C]" data-testid="review-invite-banner">
              <BadgeCheck className="h-4 w-4" /> Votre achat : {invite.product_name}
            </p>
          )}
        </Reveal>
        <Reveal delay={0.1}>
          {sent ? (
            <div className="card-soft p-8 text-center" data-testid="review-success">
              <Send className="mx-auto h-12 w-12 text-[#3B6B4C]" />
              <h2 className="mt-5 font-serif text-2xl text-[#1E3A2B]">{c.success_title}</h2>
              <p className="mt-3 whitespace-pre-line text-[#626D66]">{c.success_text}</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="card-soft space-y-5 p-6 sm:p-8" data-testid="review-form">
              {inviteError && <p className="rounded-xl bg-[#F6ECD9] px-4 py-3 text-sm text-[#7A5520]" data-testid="review-invite-error">{inviteError}</p>}
              <KindChoice kind={kind} setKind={setKind} c={c} locked={useInvite} />
              {kind === "product" && (
                <select value={form.product_slug} disabled={useInvite} onChange={(e) => set("product_slug", e.target.value)} className={field} aria-label="Produit concerné" data-testid="review-product">
                  <option value="">Choisissez le produit…</option>
                  {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <input maxLength={60} placeholder="Nom ou pseudonyme (affiché)" aria-label="Nom ou pseudonyme" value={form.name} onChange={(e) => set("name", e.target.value)} className={field} data-testid="review-name" />
                {useInvite
                  ? <p className="flex items-center rounded-xl border border-dashed border-[#CBD9CE] px-4 py-3 text-sm text-[#626D66]" data-testid="review-email-locked">E-mail de votre commande : {invite.email_hint}</p>
                  : <input type="email" maxLength={200} placeholder="Votre e-mail (jamais affiché)" aria-label="Votre e-mail" value={form.email} onChange={(e) => set("email", e.target.value)} className={field} data-testid="review-email" />}
              </div>
              <StarPicker value={form.rating} onChange={(v) => set("rating", v)} />
              <div>
                <textarea maxLength={1500} rows={6} placeholder="Votre témoignage" aria-label="Votre témoignage" value={form.text} onChange={(e) => set("text", e.target.value)} className={field} data-testid="review-text" />
                <p className="mt-1 text-right text-xs text-[#87A987]">{form.text.length} / 1500</p>
              </div>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => set("website", e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" data-testid="review-hp" />
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[#2C332E]">
                <input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1E3A2B]" data-testid="review-consent" />
                <span>{c.consent_label}</span>
              </label>
              {error && <p role="alert" className="rounded-xl bg-[#F7ECEA] px-4 py-3 text-sm text-[#8A2A1F]" data-testid="review-error">{error}</p>}
              <button type="submit" disabled={sending} data-testid="review-submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] transition-[background-color] duration-200 hover:bg-[#3B6B4C] disabled:opacity-70">
                {sending ? "Envoi…" : <>{c.submit_label} <Send className="h-4 w-4" /></>}
              </button>
              <p className="text-xs leading-relaxed text-[#626D66]" data-testid="review-privacy-note"><InlineText text={c.privacy_note} /></p>
            </form>
          )}
        </Reveal>
      </section>
    </>
  );
}
