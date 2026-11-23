import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { HeroVisual } from "@/components/Screenshot";
import { MediaCarousel, playableMedia } from "@/components/MediaCarousel";
import { PriceTag, promoEnds } from "@/components/PriceTag";
import { KeyFacts, ReassuranceStrip, ReassuranceSection, BenefitsSection, BeforeYouBuy, Testimonials } from "@/components/ProductSections";
import { getProduct, getCategories, createCheckout, mediaUrl } from "@/lib/api";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { t } from "@/lib/i18n";
import { WITHDRAWAL_CONSENT_VERSION, SITE_URL, absUrl } from "@/lib/site";
import { WithdrawalConsent } from "@/components/WithdrawalConsent";

export default function ProductDetail() {
  const { slug } = useParams();
  const [buying, setBuying] = useState(false);
  const [waiver, setWaiver] = useState(false);

  const { data: product, isLoading, isError } = useQuery({ queryKey: ["product", slug], queryFn: () => getProduct(slug) });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const category = categories.find((c) => c.slug === product?.category_slug);

  const buy = async () => {
    if (!waiver) return;
    setBuying(true);
    try {
      const res = await createCheckout({
        lookup_key: product.lookup_key, origin_url: window.location.origin,
        withdrawal_waiver: true, withdrawal_consent_version: WITHDRAWAL_CONSENT_VERSION,
      });
      // Pas d'URL Stripe valide = échec (jamais de redirection vers une adresse vide).
      if (!/^https:\/\/checkout\.stripe\.com\//.test(res?.checkout_url || "")) throw Object.assign(new Error("no_checkout_url"), { kind: "session" });
      window.location.href = res.checkout_url;
    } catch (e) {
      const status = e.response?.status;
      const kind = e.kind || (e.response ? "api" : "network");
      if (process.env.NODE_ENV !== "production") console.error("[checkout]", kind, status, e.response?.data?.detail || e.message);
      toast.error(
        kind === "network" ? "Connexion impossible au service de paiement. Vérifiez votre connexion puis réessayez."
          : status === 409 ? "Ce produit n'est pas disponible à l'achat pour le moment."
          : status === 400 ? (e.response?.data?.detail || "Merci de cocher la case relative au droit de rétractation.")
          : "Le paiement n'a pas pu démarrer. Réessayez dans un instant.",
      );
      setBuying(false);
    }
  };

  if (isLoading) return <div className="container-app py-24 text-center text-[#626D66]">Chargement…</div>;
  if (isError || !product) return <div className="container-app py-24 text-center text-[#626D66]">Produit introuvable.</div>;

  const coming = !product.purchasable;
  const media = playableMedia([
    ...(product.main_image ? [{ key: "main", type: "image", storage_path: product.main_image, caption: "" }] : []),
    ...(product.gallery || []),
  ]);
  const reassurance = product.reassurance || [];

  return (
    <>
      <Seo
        title={product.seo?.title || `${product.name} — La Maison d'Auben`}
        description={product.seo?.description || product.short_description}
        image={product.main_image ? mediaUrl(product.main_image) : ""}
        path={`/boutique/${slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.short_description || product.description,
          url: `${SITE_URL}/boutique/${slug}`,
          ...(product.main_image ? { image: [absUrl(mediaUrl(product.main_image))] } : {}),
          brand: { "@type": "Brand", name: "La Maison d'Auben" },
          // Offre uniquement pour un produit réellement achetable (prix et fichier réels).
          ...(product.purchasable ? { offers: {
            "@type": "Offer", url: `${SITE_URL}/boutique/${slug}`, price: Number(product.pricing?.final ?? product.price).toFixed(2),
            priceCurrency: (product.currency || "eur").toUpperCase(), availability: "https://schema.org/InStock",
          } } : {}),
        }}
      />

      <div className="container-app pt-6">
        <Link to="/boutique" className="inline-flex items-center gap-1.5 text-sm text-[#626D66] hover:text-[#1E3A2B]" data-testid="back-to-shop">
          <ArrowLeft className="h-4 w-4" /> Retour à la boutique
        </Link>
      </div>

      {/* HERO PRODUIT : visuels + décision d'achat */}
      <section className="container-app grid items-start gap-10 py-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-12">
        <Reveal className="min-w-0 lg:sticky lg:top-24">
          {media.length ? <MediaCarousel media={media} /> : <HeroVisual url="" caption={product.name} />}
          {media.length > 1 && <p className="mt-3 text-center text-xs text-[#87A987]" data-testid="gallery-hint">Découvrez les différentes vues de votre outil.</p>}
        </Reveal>
        <Reveal delay={0.1} className="min-w-0">
          {category && (
            <span className="eyebrow inline-flex items-center gap-1.5">
              <Icon name={category.icon} className="h-3.5 w-3.5" /> {category.name}
            </span>
          )}
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg text-[#626D66]">{product.short_description}</p>
          {!coming ? (
            <>
              <div className="mt-7">
                <PriceTag product={product} size="lg" testid="product-price" />
                <p className="mt-1.5 text-sm text-[#87A987]">Paiement unique · Téléchargement immédiat</p>
                {promoEnds(product) && <p className="mt-1 text-xs font-medium text-[#A9772F]" data-testid="promo-ends">{promoEnds(product)}</p>}
              </div>
              <KeyFacts product={product} />
              <WithdrawalConsent id="withdrawal-consent" checked={waiver} onChange={setWaiver} />
              <button
                onClick={buy}
                disabled={buying || !waiver}
                aria-describedby="withdrawal-consent"
                data-testid="buy-now-btn"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-8 py-4 text-lg font-medium text-[#FAF8F5] transition-[background-color,transform] duration-200 hover:bg-[#3B6B4C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {buying ? t("cta.buy_processing") : <>{t("cta.buy")} <ArrowRight className="h-5 w-5" /></>}
              </button>
              <ReassuranceStrip items={reassurance} />
            </>
          ) : (
            <div className="mt-8 rounded-2xl bg-[#F2EDE4] p-6">
              <span className="rounded-full bg-[#D4A359] px-3 py-1 text-xs font-semibold text-white">Bientôt disponible</span>
              <p className="mt-3 text-[#2C332E]">Ce produit arrive bientôt dans la Maison. Inscrivez-vous à la newsletter pour être prévenu·e en premier.</p>
            </div>
          )}
        </Reveal>
      </section>

      {!coming && <ReassuranceSection items={reassurance} />}

      <>
          <BenefitsSection benefits={product.benefits} />

          {/* PRÉSENTATION */}
          <section className="bg-[#F2EDE4] py-14 sm:py-20">
            <div className="container-app grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <Reveal>
                <span className="eyebrow">Présentation</span>
                <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">Pour qui, et pourquoi ?</h2>
                <p className="mt-5 whitespace-pre-line text-[#626D66]">{product.description}</p>
                {product.audience && <p className="mt-4 whitespace-pre-line text-[#626D66]">{product.audience}</p>}
              </Reveal>
              <Reveal delay={0.1}>
                <img
                  src="/images/product-desk.jpg"
                  alt="Espace de travail organisé"
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_18px_40px_-18px_rgba(30,58,43,0.3)]"
                />
              </Reveal>
            </div>
          </section>

          {/* FONCTIONNALITÉS */}
          {(product.features || []).length > 0 && (
            <section className="container-app py-14 sm:py-20">
              <Reveal className="mx-auto max-w-2xl text-center">
                <span className="eyebrow">Fonctionnalités</span>
                <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">Tout ce qu'il vous faut, au bon endroit.</h2>
              </Reveal>
              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {product.features.map((f, i) => (
                  <Reveal key={f.title || i} delay={(i % 3) * 0.06}>
                    <div className="card-soft h-full p-7">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#3B6B4C]">
                        <Icon name={f.icon} className="h-6 w-6" />
                      </div>
                      <h3 className="mt-5 font-serif text-lg font-semibold text-[#1E3A2B]">{f.title}</h3>
                      <p className="mt-2 text-sm text-[#626D66]">{f.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          <div className="bg-[#FAF8F5]"><BeforeYouBuy product={product} /></div>

          <Testimonials place="product" product={product.slug} />

          {/* FAQ PRODUIT */}
          {(product.faq || []).length > 0 && (
            <section className="bg-[#F2EDE4] py-14 sm:py-20">
              <div className="container-app mx-auto max-w-3xl">
                <Reveal className="text-center">
                  <span className="eyebrow">Questions fréquentes</span>
                  <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">On répond à vos questions.</h2>
                </Reveal>
                <Reveal delay={0.1}>
                  <Accordion type="single" collapsible className="mt-8" data-testid="product-faq">
                    {product.faq.map((f, i) => (
                      <AccordionItem key={i} value={`item-${i}`} className="mb-3 rounded-xl border border-[#E2DDD5] bg-white px-5">
                        <AccordionTrigger className="text-left font-medium text-[#1E3A2B] hover:no-underline">{f.q}</AccordionTrigger>
                        <AccordionContent className="text-[#626D66]">{f.a}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Reveal>
              </div>
            </section>
          )}

          {/* CTA FINAL */}
          <section className="container-app py-14 sm:py-20">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-[#1E3A2B] p-10 text-center grain sm:p-16">
                <div className="relative z-10 mx-auto max-w-xl">
                  <h2 className="font-serif text-3xl font-semibold text-[#FAF8F5] sm:text-4xl">{product.name}</h2>
                  {coming ? (
                    <>
                      <p className="mt-4 font-serif text-2xl text-[#D4A359]">Bientôt disponible</p>
                      <p className="mt-3 text-[#CBD9CE]">Inscrivez-vous à la newsletter pour être prévenu·e dès sa sortie.</p>
                      <Link
                        to="/"
                        data-testid="coming-soon-cta-final"
                        className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4A359] px-8 py-4 text-lg font-medium text-[#1E3A2B] transition-all hover:brightness-105 active:scale-[0.99]"
                      >
                        Être prévenu·e <ArrowRight className="h-5 w-5" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mt-4"><PriceTag product={product} dark testid="final-price" /></p>
                      <div className="flex justify-center">
                        <WithdrawalConsent id="withdrawal-consent-final" checked={waiver} onChange={setWaiver} dark />
                      </div>
                      <button
                        onClick={buy}
                        disabled={buying || !waiver}
                        aria-describedby="withdrawal-consent-final"
                        data-testid="buy-now-btn-final"
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4A359] px-8 py-4 text-lg font-medium text-[#1E3A2B] transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {buying ? t("cta.buy_processing") : <>{t("cta.buy")} <ArrowRight className="h-5 w-5" /></>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Reveal>
          </section>
      </>

    </>
  );
}
