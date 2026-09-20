import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Download, Lock, ShieldCheck, X, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { Screenshot, LaptopMockup } from "@/components/Screenshot";
import { getProduct, getCategories, createCheckout, mediaUrl } from "@/lib/api";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { formatPrice, t } from "@/lib/i18n";

export default function ProductDetail() {
  const { slug } = useParams();
  const [buying, setBuying] = useState(false);
  const [lightbox, setLightbox] = useState(null); // index

  const { data: product, isLoading, isError } = useQuery({ queryKey: ["product", slug], queryFn: () => getProduct(slug) });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const category = categories.find((c) => c.slug === product?.category_slug);

  const buy = async () => {
    setBuying(true);
    try {
      const { checkout_url } = await createCheckout({ lookup_key: product.lookup_key, origin_url: window.location.origin });
      window.location.href = checkout_url;
    } catch (e) {
      toast.error("Le paiement n'a pas pu démarrer. Réessayez.");
      setBuying(false);
    }
  };

  if (isLoading) return <div className="container-app py-24 text-center text-[#626D66]">Chargement…</div>;
  if (isError || !product) return <div className="container-app py-24 text-center text-[#626D66]">Produit introuvable.</div>;

  const gallery = product.gallery || [];
  const coming = product.status === "coming_soon";
  const galleryUrl = (g) => (g.url ? g.url : g.storage_path ? mediaUrl(g.storage_path) : "");

  return (
    <>
      <Seo title={product.seo?.title || `${product.name} — La Maison d'Auben`} description={product.seo?.description || product.short_description} path={`/boutique/${slug}`} />

      <div className="container-app pt-6">
        <Link to="/boutique" className="inline-flex items-center gap-1.5 text-sm text-[#626D66] hover:text-[#1E3A2B]" data-testid="back-to-shop">
          <ArrowLeft className="h-4 w-4" /> Retour à la boutique
        </Link>
      </div>

      {/* HERO PRODUIT */}
      <section className="container-app grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-14">
        <Reveal>
          <div className="relative p-2">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-[#EAF0EC] to-[#F2EDE4]" />
            <LaptopMockup url={product.main_image ? mediaUrl(product.main_image) : ""} caption={product.name} />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          {category && (
            <span className="eyebrow inline-flex items-center gap-1.5">
              <Icon name={category.icon} className="h-3.5 w-3.5" /> {category.name}
            </span>
          )}
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg text-[#626D66]">{product.short_description}</p>
          {!coming ? (
            <>
              <div className="mt-8 flex items-baseline gap-3">
                <span className="font-serif text-4xl font-bold text-[#1E3A2B]">{formatPrice(product.price, product.currency)}</span>
                <span className="text-sm text-[#87A987]">Paiement unique · Téléchargement immédiat</span>
              </div>
              <button
                onClick={buy}
                disabled={buying}
                data-testid="buy-now-btn"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-8 py-4 text-lg font-medium text-[#FAF8F5] transition-all duration-200 hover:bg-[#3B6B4C] active:scale-[0.99] disabled:opacity-70 sm:w-auto"
              >
                {buying ? t("cta.buy_processing") : <>{t("cta.buy")} <ArrowRight className="h-5 w-5" /></>}
              </button>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-[#626D66]">
                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-[#3B6B4C]" /> Paiement sécurisé Stripe</span>
                <span className="inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5 text-[#3B6B4C]" /> Accès immédiat</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#3B6B4C]" /> Lien de téléchargement protégé</span>
              </div>
            </>
          ) : (
            <div className="mt-8 rounded-2xl bg-[#F2EDE4] p-6">
              <span className="rounded-full bg-[#D4A359] px-3 py-1 text-xs font-semibold text-white">Bientôt disponible</span>
              <p className="mt-3 text-[#2C332E]">Ce produit arrive bientôt dans la Maison. Inscrivez-vous à la newsletter pour être prévenu·e en premier.</p>
            </div>
          )}
        </Reveal>
      </section>

      {!coming && (
        <>
          {/* PRÉSENTATION */}
          <section className="bg-[#F2EDE4] py-14 sm:py-20">
            <div className="container-app grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <Reveal>
                <span className="eyebrow">Présentation</span>
                <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">Pour qui, et pourquoi ?</h2>
                <p className="mt-5 text-[#626D66]">{product.description}</p>
                {product.audience && <p className="mt-4 text-[#626D66]">{product.audience}</p>}
              </Reveal>
              <Reveal delay={0.1}>
                <img
                  src="https://images.unsplash.com/photo-1649119162006-304b172c12d8?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
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
                  <Reveal key={f.title} delay={(i % 3) * 0.06}>
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

          {/* GALERIE */}
          {gallery.length > 0 && (
            <section className="bg-[#F2EDE4] py-14 sm:py-20">
              <div className="container-app">
                <Reveal className="mx-auto max-w-2xl text-center">
                  <span className="eyebrow">Galerie</span>
                  <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">Un aperçu du produit</h2>
                  <p className="mt-4 text-[#626D66]">Cliquez pour agrandir. Les vraies captures du fichier seront ajoutées ici.</p>
                </Reveal>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {gallery.map((g, i) => (
                    <Reveal key={g.key || i} delay={(i % 3) * 0.06}>
                      <button
                        onClick={() => setLightbox(i)}
                        data-testid={`gallery-item-${i}`}
                        className="block w-full overflow-hidden rounded-xl transition-transform duration-300 hover:scale-[1.02]"
                      >
                        <Screenshot url={galleryUrl(g)} caption={g.caption} icon="BarChart3" ratio="aspect-[16/11]" />
                      </button>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* CONTENU + COMPATIBILITÉ */}
          <section className="container-app grid gap-8 py-14 sm:py-20 lg:grid-cols-2">
            <Reveal>
              <div className="card-soft h-full p-8">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-6 w-6 text-[#3B6B4C]" />
                  <h2 className="font-serif text-2xl font-semibold text-[#1E3A2B]">Ce que vous recevez</h2>
                </div>
                <ul className="mt-6 space-y-3">
                  {(product.contents || []).map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-sm text-[#2C332E]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3B6B4C]" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="card-soft h-full p-8">
                <h2 className="font-serif text-2xl font-semibold text-[#1E3A2B]">Compatibilité</h2>
                <ul className="mt-6 space-y-3">
                  {(product.compatibility || []).map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-sm text-[#2C332E]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3B6B4C]" /> {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 rounded-xl bg-[#EAF0EC] p-4 text-sm text-[#2C332E]">
                  Après paiement, vous recevez un lien de téléchargement sécurisé, valable immédiatement et par e-mail.
                </p>
              </div>
            </Reveal>
          </section>

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
                  <p className="mt-4 font-serif text-2xl text-[#D4A359]">{formatPrice(product.price, product.currency)}</p>
                  <button
                    onClick={buy}
                    disabled={buying}
                    data-testid="buy-now-btn-final"
                    className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4A359] px-8 py-4 text-lg font-medium text-[#1E3A2B] transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-70"
                  >
                    {buying ? t("cta.buy_processing") : <>{t("cta.buy")} <ArrowRight className="h-5 w-5" /></>}
                  </button>
                </div>
              </div>
            </Reveal>
          </section>
        </>
      )}

      {/* LIGHTBOX */}
      {lightbox !== null && gallery[lightbox] && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1E3A2B]/80 p-4 backdrop-blur-sm" onClick={() => setLightbox(null)} data-testid="lightbox">
          <button className="absolute right-5 top-5 text-white/80 hover:text-white" onClick={() => setLightbox(null)} aria-label="Fermer"><X className="h-8 w-8" /></button>
          <button className="absolute left-4 text-white/80 hover:text-white" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + gallery.length) % gallery.length); }} aria-label="Précédent"><ChevronLeft className="h-10 w-10" /></button>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <Screenshot url={galleryUrl(gallery[lightbox])} caption={gallery[lightbox].caption} ratio="aspect-[16/10]" />
            <p className="mt-4 text-center font-serif text-lg text-white">{gallery[lightbox].caption}</p>
          </div>
          <button className="absolute right-4 text-white/80 hover:text-white" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % gallery.length); }} aria-label="Suivant"><ChevronRight className="h-10 w-10" /></button>
        </div>
      )}
    </>
  );
}
