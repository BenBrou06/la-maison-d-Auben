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
import { useContent } from "@/lib/content";

const PRINCIPLE_ICONS = [Sparkles, Wand2, Star, HeartHandshake];

export default function Home() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => getArticles() });

  const c = useContent("home");
  const featured = (c.featured_slug && products.find((p) => p.slug === c.featured_slug)) || products.find((p) => p.purchasable);
  const heroImage = c.hero_image ? mediaUrl(c.hero_image) : featured?.main_image ? mediaUrl(featured.main_image) : "";
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  return (
    <>
      <Seo
        title={c.seo_title}
        description={c.seo_description}
        path="/"
      />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container-app grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
          <Reveal>
            <span className="eyebrow inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> {c.hero_eyebrow}
            </span>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[#1E3A2B] sm:text-5xl lg:text-6xl">
              {c.hero_title.split("\n").map((ln, i) => <React.Fragment key={i}>{i > 0 && <br />}{ln}</React.Fragment>)}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-[#626D66] sm:text-lg">
              {c.hero_intro || settings?.hero_intro ||
                "Des outils numériques simples, beaux et intelligents pour mieux organiser votre vie, vos projets et vos envies."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/boutique"
                data-testid="hero-primary-cta"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] transition-all duration-200 hover:bg-[#3B6B4C] active:scale-[0.98]"
              >
                {c.hero_cta_primary} <ArrowRight className="h-4 w-4" />
              </Link>
              {featured && (
                <Link
                  to={`/boutique/${featured.slug}`}
                  data-testid="hero-secondary-cta"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#87A987]/40 bg-[#EAF0EC] px-6 py-3.5 font-medium text-[#1E3A2B] transition-all duration-200 hover:bg-[#1E3A2B] hover:text-[#FAF8F5]"
                >
                  {c.hero_cta_secondary || `Découvrir ${featured.name}`}
                </Link>
              )}
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-[#EAF0EC] to-[#F2EDE4]" />
              <HeroVisual url={heroImage} caption={c.hero_caption || featured?.name || "Budget mensuel"} />
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
                <HeroVisual url={featured.main_image ? mediaUrl(featured.main_image) : ""} caption={c.featured_caption} />
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <span className="eyebrow">{c.featured_eyebrow}</span>
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
                {featured.purchasable
                  ? <span className="font-serif text-3xl font-bold text-[#1E3A2B]">{formatPrice(featured.price, featured.currency)}</span>
                  : <span className="rounded-full bg-[#D4A359] px-3 py-1 text-xs font-semibold text-white" data-testid="featured-coming-soon">{t("badge.coming_soon")}</span>}
                <Link
                  to={`/boutique/${featured.slug}`}
                  data-testid="featured-cta"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] transition-all hover:bg-[#3B6B4C]"
                >
                  {c.featured_cta} <ArrowRight className="h-4 w-4" />
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
            <span className="eyebrow">{c.why_eyebrow}</span>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">
              {c.why_title}
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.principles.map((p, i) => {
              const PIcon = PRINCIPLE_ICONS[i % PRINCIPLE_ICONS.length];
              return (
              <Reveal key={i} delay={i * 0.08}>
                <div className="card-soft h-full p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#3B6B4C]">
                    <PIcon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-semibold text-[#1E3A2B]">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#626D66]">{p.text}</p>
                </div>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* NOTRE UNIVERS */}
      <section className="container-app py-14 sm:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">{c.universe_eyebrow}</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">
            {c.universe_title}
          </h2>
          <p className="mt-4 text-[#626D66]">{c.universe_text}</p>
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
              <span className="eyebrow text-[#87A987]">{c.brand_eyebrow}</span>
              <p className="mt-5 font-serif text-2xl leading-snug text-[#FAF8F5] sm:text-3xl lg:text-4xl">
                {c.brand_text}
              </p>
              <Link
                to="/a-propos"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#D4A359] px-6 py-3.5 font-medium text-[#1E3A2B] transition-all hover:brightness-105"
              >
                {c.brand_cta} <ArrowRight className="h-4 w-4" />
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
              <span className="eyebrow">{c.resources_eyebrow}</span>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">{c.resources_title}</h2>
            </div>
            <Link to="/ressources" className="hidden items-center gap-1.5 text-sm font-medium text-[#3B6B4C] hover:text-[#1E3A2B] sm:inline-flex">
              {c.resources_link} <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {articles.slice(0, 3).map((a, i) => (
              <Reveal key={a.slug} delay={i * 0.08}>
                <Link to={`/ressources/${a.slug}`} data-testid={`home-article-${a.slug}`} className="group card-soft block h-full overflow-hidden">
                  <div className="aspect-[16/10] overflow-hidden">
                    <img src={mediaUrl(a.cover_image)} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
          <Newsletter title={c.newsletter_title || settings?.newsletter_title} text={c.newsletter_text || settings?.newsletter_text} />
        </Reveal>
      </section>
    </>
  );
}
