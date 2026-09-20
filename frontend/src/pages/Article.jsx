import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, ArrowLeft, ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { ProductCard } from "@/components/ProductCard";
import { getArticle, getCategories } from "@/lib/api";

export default function Article() {
  const { slug } = useParams();
  const { data: article, isLoading, isError } = useQuery({ queryKey: ["article", slug], queryFn: () => getArticle(slug) });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  if (isLoading) return <div className="container-app py-24 text-center text-[#626D66]">Chargement…</div>;
  if (isError || !article) return <div className="container-app py-24 text-center text-[#626D66]">Article introuvable.</div>;

  const date = article.published_at ? new Date(article.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  const related = article.related_products || [];

  return (
    <>
      <Seo title={`${article.title} — La Maison d'Auben`} description={article.excerpt} image={article.cover_image} path={`/ressources/${slug}`} />

      <article className="container-app mx-auto max-w-3xl py-10 sm:py-14">
        <Link to="/ressources" className="inline-flex items-center gap-1.5 text-sm text-[#626D66] hover:text-[#1E3A2B]"><ArrowLeft className="h-4 w-4" /> Toutes les ressources</Link>
        <Reveal>
          <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[#3B6B4C]">
            <span>{article.category}</span>
            <span>·</span>
            <span>{date}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[#87A987]"><Clock className="h-3 w-3" /> {article.read_time} min</span>
          </div>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-[#1E3A2B] sm:text-5xl">{article.title}</h1>
        </Reveal>
        <Reveal delay={0.1}>
          <img src={article.cover_image} alt={article.title} className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover" />
        </Reveal>

        <div className="prose mt-10 max-w-none">
          {(article.content || []).map((block, i) => {
            if (block.type === "h2") return <h2 key={i} className="mt-8 font-serif text-2xl font-semibold text-[#1E3A2B]">{block.text}</h2>;
            return <p key={i} className="mt-4 text-lg leading-relaxed text-[#2C332E]">{block.text}</p>;
          })}
        </div>

        {article.cta_text && related.length > 0 && (
          <div className="mt-12 rounded-2xl bg-[#1E3A2B] p-8 text-center grain">
            <p className="relative z-10 font-serif text-xl text-[#FAF8F5]">{article.cta_text}</p>
            <Link to={`/boutique/${related[0].slug}`} className="relative z-10 mt-5 inline-flex items-center gap-2 rounded-xl bg-[#D4A359] px-6 py-3.5 font-medium text-[#1E3A2B] hover:brightness-105">
              Découvrir {related[0].name} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </article>

      {related.length > 0 && (
        <section className="container-app py-10 sm:py-16">
          <h2 className="font-serif text-2xl font-semibold text-[#1E3A2B]">À découvrir</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => <ProductCard key={p.slug} product={p} category={catMap[p.category_slug]} />)}
          </div>
        </section>
      )}
    </>
  );
}
