import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Check, FileSpreadsheet, Info, Quote, Star } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { getTestimonials } from "@/lib/api";

const FORMATS = { xlsx: "Classeur Excel (.xlsx)", xls: "Classeur Excel (.xls)", csv: "Fichier CSV", pdf: "Document PDF", zip: "Archive ZIP" };

export const formatOf = (p) => {
  if (p.practical?.format) return p.practical.format;
  const ext = (p.download_filename || "").split(".").pop().toLowerCase();
  return FORMATS[ext] || "";
};

export const accessOf = (p) => p.practical?.access
  || `Lien de téléchargement affiché après le paiement et envoyé par e-mail, valable ${p.download_terms?.days ?? 30} jours (${p.download_terms?.limit ?? 25} téléchargements).`;

// Résumé court près du bouton d'achat.
export const KeyFacts = ({ product }) => {
  const facts = [
    ["Produit", "Fichier numérique à télécharger"],
    ["Format", formatOf(product)],
    ["Compatible", (product.compatibility || []).join(", ")],
    ["Niveau", product.practical?.level],
  ].filter(([, v]) => v);
  return (
    <dl className="mt-6 grid gap-x-6 gap-y-2.5 rounded-2xl border border-[#E2DDD5] bg-white/70 p-5 text-sm sm:grid-cols-2" data-testid="key-facts">
      {facts.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wider text-[#87A987]">{k}</dt>
          <dd className="mt-0.5 text-[#2C332E]" data-testid={`key-fact-${k.toLowerCase()}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
};

export const ReassuranceStrip = ({ items }) => (
  <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#626D66]" data-testid="reassurance-strip">
    {items.slice(0, 3).map((r) => (
      <li key={r.key} className="inline-flex items-center gap-1.5"><Icon name={r.icon} className="h-3.5 w-3.5 text-[#3B6B4C]" /> {r.title}</li>
    ))}
  </ul>
);

export const ReassuranceSection = ({ items }) => {
  if (!items.length) return null;
  return (
    <section className="border-y border-[#E2DDD5] bg-[#FAF8F5]" data-testid="reassurance-section">
      <div className="container-app grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r, i) => (
          <Reveal key={r.key} delay={(i % 3) * 0.05}>
            <div className="flex gap-4" data-testid={`reassurance-item-${r.key}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF0EC] text-[#3B6B4C]"><Icon name={r.icon} className="h-5 w-5" /></span>
              <div>
                <p className="font-medium text-[#1E3A2B]">{r.title}</p>
                {r.text && <p className="mt-1 text-sm text-[#626D66]">{r.text}</p>}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

export const BenefitsSection = ({ benefits }) => {
  const list = (benefits || []).filter((b) => b.title?.trim());
  if (!list.length) return null;
  return (
    <section className="container-app py-14 sm:py-20" data-testid="benefits-section">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <span className="eyebrow">Ce que vous y gagnez</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">Concrètement, ce qui change pour vous.</h2>
        </Reveal>
        <ol className="space-y-6">
          {list.map((b, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <li className="flex gap-5 border-b border-[#E2DDD5] pb-6 last:border-0" data-testid={`benefit-${i}`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E3A2B] text-[#D4A359]"><Icon name={b.icon} className="h-6 w-6" /></span>
                <div>
                  <h3 className="font-serif text-xl font-semibold text-[#1E3A2B]">{b.title}</h3>
                  {b.text && <p className="mt-1.5 text-[#626D66]">{b.text}</p>}
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
};

const Bullets = ({ items }) => (
  <ul className="mt-5 space-y-3">
    {items.map((c) => (
      <li key={c} className="flex items-start gap-2.5 text-sm text-[#2C332E]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3B6B4C]" /> {c}</li>
    ))}
  </ul>
);

export const BeforeYouBuy = ({ product }) => {
  const pr = product.practical || {};
  const rows = [
    ["Type de produit", "Fichier numérique à télécharger : aucun envoi physique."],
    ["Format fourni", formatOf(product)],
    ["Niveau requis", pr.level],
    ["Accès après achat", accessOf(product)],
    ["Conditions d'utilisation", pr.license],
    ["Limitations à connaître", pr.limitations],
  ].filter(([, v]) => v);
  return (
    <section className="container-app grid gap-6 py-14 sm:py-20 lg:grid-cols-3" data-testid="before-you-buy">
      <Reveal>
        <div className="card-soft h-full p-7">
          <div className="flex items-center gap-3"><FileSpreadsheet className="h-6 w-6 text-[#3B6B4C]" /><h2 className="font-serif text-2xl font-semibold text-[#1E3A2B]">Ce que vous recevez</h2></div>
          <Bullets items={product.contents || []} />
        </div>
      </Reveal>
      <Reveal delay={0.06}>
        <div className="card-soft h-full p-7">
          <h2 className="font-serif text-2xl font-semibold text-[#1E3A2B]">Compatibilité</h2>
          <Bullets items={product.compatibility || []} />
        </div>
      </Reveal>
      <Reveal delay={0.12}>
        <div className="card-soft h-full p-7" data-testid="practical-info">
          <div className="flex items-center gap-3"><Info className="h-6 w-6 text-[#3B6B4C]" /><h2 className="font-serif text-2xl font-semibold text-[#1E3A2B]">Bon à savoir</h2></div>
          <dl className="mt-5 space-y-4 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}><dt className="font-medium text-[#1E3A2B]">{k}</dt><dd className="mt-0.5 whitespace-pre-line text-[#626D66]">{v}</dd></div>
            ))}
          </dl>
          <Link to="/produits-numeriques" className="mt-5 inline-block text-sm font-medium text-[#3B6B4C] underline-offset-4 hover:underline" data-testid="digital-terms-link">Conditions des produits numériques</Link>
        </div>
      </Reveal>
    </section>
  );
};

const Stars = ({ n }) => (
  <span className="flex gap-0.5" aria-label={`Note : ${n} sur 5`}>
    {[1, 2, 3, 4, 5].map((k) => <Star key={k} className={`h-4 w-4 ${k <= n ? "fill-[#D4A359] text-[#D4A359]" : "text-[#E2DDD5]"}`} />)}
  </span>
);

// Rien n'est affiché tant qu'aucun témoignage authentique n'est publié.
const ReviewLink = ({ cta, place }) => (
  <Link to={cta.to} className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#3B6B4C] underline-offset-4 hover:underline" data-testid={`review-link-${place}`}>
    {cta.label} <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
  </Link>
);

export const Testimonials = ({ place, product = "", title = "Ils l'utilisent au quotidien.", cta }) => {
  const { data = [] } = useQuery({ queryKey: ["testimonials", place, product], queryFn: () => getTestimonials(place, product) });
  if (!data.length) {
    return cta ? <div className="container-app py-8 text-center" data-testid={`review-cta-${place}`}><ReviewLink cta={cta} place={place} /></div> : null;
  }
  return (
    <section className="container-app py-14 sm:py-20" data-testid={`testimonials-${place}`}>
      <Reveal className="max-w-2xl">
        <span className="eyebrow">Témoignages</span>
        <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">{title}</h2>
      </Reveal>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data.map((t, i) => (
          <Reveal key={t.id} delay={(i % 3) * 0.06}>
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
            </figure>
          </Reveal>
        ))}
      </div>
      {cta && <div className="mt-8"><ReviewLink cta={cta} place={place} /></div>}
    </section>
  );
};
