import React from "react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { useContent, RichText } from "@/lib/content";
import { PAGE_BY_KEY } from "@/content/schema";

// Contenu par défaut dans content/legal.js ; seules les modifications faites dans l'admin sont stockées.
export default function Legal({ pageKey }) {
  const key = `legal-${pageKey}`;
  const c = useContent(key);
  if (!PAGE_BY_KEY[key]) return <div className="container-app py-24 text-center text-[#626D66]">Page introuvable.</div>;
  return (
    <>
      <Seo title={c.seo_title} description={c.seo_description} path={`/${pageKey}`} />
      <div className="container-app mx-auto max-w-3xl py-14 sm:py-20" data-testid={`legal-page-${pageKey}`}>
        <Reveal>
          <h1 className="font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">{c.title}</h1>
          <p className="mt-4 text-[#626D66]">{c.intro}</p>
          <p className="mt-2 text-xs text-[#626D66]">Dernière mise à jour : {c.updated}</p>
        </Reveal>
        <div className="mt-10 space-y-8">
          {(c.sections || []).map((s, i) => (
            <Reveal key={i} delay={i * 0.03}>
              <section data-testid={`legal-section-${pageKey}-${i}`}>
                <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">{s.title}</h2>
                <RichText body={s.body} pClass="mt-2 leading-relaxed text-[#2C332E]" ulClass="mt-3 list-disc space-y-1.5 pl-5 text-[#2C332E]" liClass="leading-relaxed" />
              </section>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}
