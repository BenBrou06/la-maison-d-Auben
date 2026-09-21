import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Sparkles, Star, Wand2, HeartHandshake } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Icon";
import { LaptopMockup, HeroVisual } from "@/components/Screenshot";
import { ProductCard } from "@/components/ProductCard";
import { Newsletter } from "@/components/Newsletter";
import { getSettings, getProducts, getCategories, getArticles, mediaUrl } from "@/lib/api";
import { formatPrice, t } from "@/lib/i18n";

const PRINCIPLES = [
  { icon: Sparkles, title: "Simple", text: "Des outils faciles à prendre en main, sans être un expert d'Excel." },
  { icon: Wand2, title: "Utile", text: "Des fonctionnalités pensées pour répondre à de vrais besoins du quotidien." },
  { icon: Star, title: "Beau", text: "Des outils agréables à utiliser, que l'on a envie d'ouvrir chaque jour." },
  { icon: HeartHandshake, title: "Accessible", text: "Des produits accessibles, sans abonnement compliqué." },
];

export default function Home() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => getArticles() });

  const featured = products.find((p) => p.status === "available");
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  return (
    <>
      <Seo
        title="La Maison d'Auben — L'aubaine pour mieux s'organiser."
        description="Des outils numériques simples, beaux et intelligents pour mieux organiser votre vie, vos projets et vos envies."
        path="/"
      />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container-app grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
          <Reveal>
            <span className="eyebrow inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Produits numériques
            </span>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#1E3A2B] sm:text-5xl lg:text-6xl">
              L'aubaine pour<br /> mieux s'organiser.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-[#626D66] sm:text-lg">
              {settings?.hero_intro ||
                "Des outils numériques simples, beaux et intelligents pour mieux organiser votre vie, vos projets et vos envies."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/boutique"
                data-testid="hero-primary-cta"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] transition-all duration-200 hover:bg-[#3B6B4C] active:scale-[0.98]"
              >
                {t("cta.discover_tools")} <ArrowRight className="h-4 w-4" />
              </Link>
              {featured && (
                <Link
                  to={`/boutique/${featured.slug}`}
                  data-testid="hero-secondary-cta"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#87A987]/40 bg-[#EAF0EC] px-6 py-3.5 font-medium text-[#1E3A2B] transition-all duration-200 hover:bg-[#1E3A2B] hover:text-[#FAF8F5]"
                >
                  {t("cta.discover_product")}
                </Link>
              )}
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-[#EAF0EC] to-[#F2EDE4]" />
              <HeroVisual url={featured?.main_image ? mediaUrl(featured.main_image) : ""} caption="Budget mensuel" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRODUIT PHARE */}
      {featured && (
        <section className="container-app py-14 sm:py-20">
          <div className="card-soft grid gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <div className="p-2">
                <HeroVisual url={featured.main_image ? mediaUrl(featured.main_image) : ""} caption="Aperçu du produit" />
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <span className="eyebrow">Produit phare</span>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">{featured.name}</h2>
              <p className="mt-4 text-[#626D66]">{featured.description}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {(featured.features || []).slice(0, 4).map((f) => (
                  <li key={f.title} className="flex items-start gap-2.5 text-sm text-[#2C332E]">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#EAF0EC] text-[#3B6B4C]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span><strong className="font-semibold">{f.title}</strong> — {f.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-center gap-5">
                <span className="font-serif text-3xl font-bold text-[#1E3A2B]">{formatPrice(featured.price, featured.currency)}</span>
                <Link
                  to={`/boutique/${featured.slug}`}
                  data-testid="featured-cta"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] transition-all hover:bg-[#3B6B4C]"
                >
                  Découvrir le produit <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* POURQUOI */}
      <section className="bg-[#F2EDE4] py-14 sm:py-20">
        <div className="container-app">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Pourquoi La Maison d'Auben ?</span>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">
              De bons outils, pensés pour la vraie vie.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08}>
                <div className="card-soft h-full p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#3B6B4C]">
                    <p.icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-semibold text-[#1E3A2B]">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#626D66]">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* NOTRE UNIVERS */}
      <section className="container-app py-14 sm:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Notre univers</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">
            Un outil pour chaque projet de vie.
          </h2>
          <p className="mt-4 text-[#626D66]">Aujourd'hui le budget. Demain, bien plus encore.</p>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c, i) => (
            <Reveal key={c.slug} delay={i * 0.05}>
              <Link
                to={`/boutique?categorie=${c.slug}`}
                data-testid={`universe-${c.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-[#E2DDD5] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#87A987] hover:shadow-[0_14px_30px_-16px_rgba(30,58,43,0.25)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#3B6B4C] transition-colors group-hover:bg-[#1E3A2B] group-hover:text-[#FAF8F5]">
                  <Icon name={c.icon} className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#1E3A2B]">{c.name}</h3>
                  <p className="mt-1 text-sm text-[#626D66]">{c.description}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* UNE MARQUE QUI ÉVOLUE */}
      <section className="container-app py-6 sm:py-10">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#1E3A2B] p-8 grain sm:p-14">
            <div className="relative z-10 max-w-3xl">
              <span className="eyebrow text-[#87A987]">Une marque qui évolue</span>
              <p className="mt-5 font-serif text-2xl leading-snug text-[#FAF8F5] sm:text-3xl lg:text-4xl">
                Aujourd'hui, mieux gérer son budget. Demain, mieux organiser ses voyages, son appartement,
                sa voiture, ses projets — et bien plus encore.
              </p>
              <Link
                to="/a-propos"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#D4A359] px-6 py-3.5 font-medium text-[#1E3A2B] transition-all hover:brightness-105"
              >
                Découvrir la Maison <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* RESSOURCES */}
      {articles.length > 0 && (
        <section className="container-app py-14 sm:py-20">
          <Reveal className="flex items-end justify-between">
            <div>
              <span className="eyebrow">Ressources</span>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">Nos derniers conseils.</h2>
            </div>
            <Link to="/ressources" className="hidden items-center gap-1.5 text-sm font-medium text-[#3B6B4C] hover:text-[#1E3A2B] sm:inline-flex">
              Tout voir <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {articles.slice(0, 3).map((a, i) => (
              <Reveal key={a.slug} delay={i * 0.08}>
                <Link to={`/ressources/${a.slug}`} data-testid={`home-article-${a.slug}`} className="group card-soft block h-full overflow-hidden">
                  <div className="aspect-[16/10] overflow-hidden">
                    <img src={a.cover_image} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-6">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#3B6B4C]">{a.category}</span>
                    <h3 className="mt-2 font-serif text-lg font-semibold text-[#1E3A2B]">{a.title}</h3>
                    <p className="mt-2 text-sm text-[#626D66]">{a.excerpt}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* NEWSLETTER */}
      <section className="container-app py-10 sm:py-16">
        <Reveal>
          <Newsletter title={settings?.newsletter_title} text={settings?.newsletter_text} />
        </Reveal>
      </section>
    </>
  );
}
