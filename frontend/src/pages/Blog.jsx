import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { getArticles } from "@/lib/api";

export default function Blog() {
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => getArticles() });
  const [featured, ...rest] = articles;

  return (
    <>
      <Seo title="Ressources — La Maison d'Auben" description="Nos conseils pour mieux organiser votre budget, vos voyages, votre maison et vos projets." path="/ressources" />
      <section className="border-b border-[#E2DDD5] bg-[#F2EDE4]">
        <div className="container-app py-12 sm:py-16">
          <Reveal>
            <span className="eyebrow">Ressources</span>
            <h1 className="mt-3 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">Nos conseils & idées</h1>
            <p className="mt-4 max-w-xl text-[#626D66]">Des articles simples et concrets pour mieux vous organiser au quotidien.</p>
          </Reveal>
        </div>
      </section>

      <div className="container-app py-12">
        {featured && (
          <Reveal>
            <Link to={`/ressources/${featured.slug}`} data-testid={`article-${featured.slug}`} className="group grid overflow-hidden rounded-3xl border border-[#E2DDD5] bg-white lg:grid-cols-2">
              <div className="aspect-[16/10] overflow-hidden lg:aspect-auto">
                <img src={featured.cover_image} alt={featured.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="flex flex-col justify-center p-8 sm:p-12">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#3B6B4C]">{featured.category}</span>
                <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1E3A2B]">{featured.title}</h2>
                <p className="mt-4 text-[#626D66]">{featured.excerpt}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#1E3A2B]">Lire l'article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link>
          </Reveal>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((a, i) => (
            <Reveal key={a.slug} delay={(i % 3) * 0.06}>
              <Link to={`/ressources/${a.slug}`} data-testid={`article-${a.slug}`} className="group card-soft block h-full overflow-hidden">
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={a.cover_image} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#3B6B4C]">
                    <span>{a.category}</span>
                    <span className="inline-flex items-center gap-1 text-[#87A987]"><Clock className="h-3 w-3" /> {a.read_time} min</span>
                  </div>
                  <h3 className="mt-2 font-serif text-lg font-semibold text-[#1E3A2B]">{a.title}</h3>
                  <p className="mt-2 text-sm text-[#626D66]">{a.excerpt}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}
