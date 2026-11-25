import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, Flag, Quote, ShieldCheck, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/Reveal";
import { getTestimonials, reportTestimonial } from "@/lib/api";

const REPORTS = [["fake", "Je doute de son authenticité"], ["abuse", "Contenu injurieux ou illicite"], ["personal", "Il contient des données personnelles"], ["other", "Autre raison"]];
const fmtDay = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const fmtMonth = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

const Stars = ({ n }) => (
  <span className="flex items-center gap-0.5" aria-label={`${n} sur 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-[#D4A359] text-[#D4A359]" : "text-[#CBD9CE]"}`} />)}
  </span>
);

const ReviewLink = ({ cta, place }) => (
  <Link to={cta.to} className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#3B6B4C] underline-offset-4 hover:underline" data-testid={`review-link-${place}`}>
    {cta.label} <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
  </Link>
);

function ReportDialog({ item, onClose }) {
  const [reason, setReason] = useState("fake");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try { await reportTestimonial(item.id, { reason, message, website: "" }); toast.success("Merci, votre signalement a été transmis. Nous allons vérifier cet avis."); onClose(); }
    catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Le signalement n'a pas pu être envoyé."); }
    setSending(false);
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="report-dialog">
        <DialogHeader>
          <DialogTitle>Signaler l'avis de {item?.name}</DialogTitle>
          <DialogDescription>Un doute sur son authenticité ou son contenu ? Nous réexaminerons l'avis. Aucune donnée personnelle n'est demandée.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2" role="radiogroup">
          {REPORTS.map(([k, l]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-[#2C332E]">
              <input type="radio" name="report" checked={reason === k} onChange={() => setReason(k)} className="accent-[#1E3A2B]" data-testid={`report-reason-${k}`} /> {l}
            </label>
          ))}
        </div>
        <textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Précision facultative"
          className="w-full rounded-xl border border-[#E2DDD5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#87A987]" data-testid="report-message" />
        <DialogFooter>
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-[#626D66] hover:bg-[#FAF8F5]" data-testid="report-cancel">Annuler</button>
          <button onClick={send} disabled={sending} className="rounded-xl bg-[#1E3A2B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3B6B4C] disabled:opacity-60" data-testid="report-submit">Envoyer le signalement</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Card = ({ t, onReport }) => (
  <figure className="card-soft flex h-full flex-col p-7" data-testid={`testimonial-${t.id}`}>
    <Quote className="h-6 w-6 text-[#D4A359]" />
    <blockquote className="mt-4 flex-1 whitespace-pre-line text-[#2C332E]">{t.text}</blockquote>
    <figcaption className="mt-5 flex items-center justify-between gap-3">
      <span className="font-serif font-semibold text-[#1E3A2B]">{t.name}</span>
      {t.rating && <Stars n={t.rating} />}
    </figcaption>
    {t.verified_purchase && (
      <span className="mt-3 inline-flex items-center gap-1 self-start rounded-full bg-[#EAF0EC] px-2.5 py-0.5 text-xs font-medium text-[#3B6B4C]" data-testid={`testimonial-verified-${t.id}`}>
        <BadgeCheck className="h-3.5 w-3.5" /> Achat vérifié
      </span>
    )}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2DDD5] pt-3 text-xs text-[#87A987]">
      <span data-testid={`testimonial-dates-${t.id}`}>Publié le {fmtDay(t.published_at)} · Expérience : {fmtMonth(t.experience_month)}</span>
      <button type="button" onClick={() => onReport(t)} className="inline-flex items-center gap-1 hover:text-[#3B6B4C] hover:underline" data-testid={`testimonial-report-${t.id}`}>
        <Flag className="h-3 w-3" /> Signaler
      </button>
    </div>
  </figure>
);

export const Testimonials = ({ place, product = "", title = "Ils l'utilisent au quotidien.", cta }) => {
  const { data = [] } = useQuery({ queryKey: ["testimonials", place, product], queryFn: () => getTestimonials(place, product) });
  const [sort, setSort] = useState("recent");
  const [reporting, setReporting] = useState(null);
  const items = useMemo(() => (sort === "recent" ? [...data].sort((a, b) => (b.published_at > a.published_at ? 1 : -1)) : data), [data, sort]);
  if (!data.length) {
    return cta ? <div className="container-app py-8 text-center" data-testid={`review-cta-${place}`}><ReviewLink cta={cta} place={place} /></div> : null;
  }
  return (
    <section className="container-app py-14 sm:py-20" data-testid={`testimonials-${place}`}>
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <span className="eyebrow">Témoignages</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">{title}</h2>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#626D66]">
          Classer par
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-[#E2DDD5] bg-white px-3 py-2 text-[#2C332E]" data-testid={`testimonials-sort-${place}`}>
            <option value="recent">Les plus récents</option>
            <option value="selection">Sélection de la maison</option>
          </select>
        </label>
      </Reveal>
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#626D66]" data-testid={`testimonials-notice-${place}`}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3B6B4C]" />
        <span>
          Chaque avis est relu avant publication ; aucune contrepartie n'est offerte. « Achat vérifié » : avis déposé depuis le lien reçu après l'achat.
          Classement : du plus récent au plus ancien, ou dans l'ordre choisi par La Maison d'Auben. <Link to="/avis-clients" className="underline hover:text-[#3B6B4C]" data-testid={`testimonials-policy-link-${place}`}>Comment nos avis sont contrôlés</Link>
        </span>
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => <Reveal key={t.id} delay={(i % 3) * 0.06}><Card t={t} onReport={setReporting} /></Reveal>)}
      </div>
      {cta && <div className="mt-8"><ReviewLink cta={cta} place={place} /></div>}
      <ReportDialog key={reporting?.id || "none"} item={reporting} onClose={() => setReporting(null)} />
    </section>
  );
};
