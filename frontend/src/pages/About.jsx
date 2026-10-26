import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Heart, Leaf } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { useContent, RichText } from "@/lib/content";
import { mediaUrl } from "@/lib/api";

const VALUE_ICONS = [Sparkles, Heart, Leaf];

export default function About() {
  const c = useContent("about");
  return (
    <>
      <Seo title={c.seo_title} description={c.seo_description} path="/a-propos" />

      <section className="container-app py-14 sm:py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">{c.eyebrow}</span>
          <h1 className="mt-4 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl lg:text-6xl">
            {c.title}{c.title_highlight && <span className="text-[#3B6B4C]">{c.title_highlight}</span>}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#626D66]">
            {c.intro}
          </p>
        </Reveal>
      </section>

      <section className="bg-[#F2EDE4] py-14 sm:py-20">
        <div className="container-app grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <img
              src={mediaUrl(c.image)}
              alt={c.image_alt}
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_18px_40px_-18px_rgba(30,58,43,0.3)]"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">{c.story_title}</h2>
            <div className="mt-5 space-y-4 text-[#626D66]">
              <RichText body={c.story_text} ulClass="list-disc space-y-1.5 pl-5" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-app py-14 sm:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {c.values.map((v, i) => {
            const VIcon = VALUE_ICONS[i % VALUE_ICONS.length];
            return (
            <Reveal key={i} delay={i * 0.08}>
              <div className="card-soft h-full p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#3B6B4C]"><VIcon className="h-6 w-6" strokeWidth={1.75} /></div>
                <h3 className="mt-5 font-serif text-xl font-semibold text-[#1E3A2B]">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#626D66]">{v.text}</p>
              </div>
            </Reveal>
            );
          })}
        </div>
      </section>

      <section className="container-app pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#1E3A2B] p-10 text-center grain sm:p-14">
            <div className="relative z-10 mx-auto max-w-xl">
              <h2 className="font-serif text-3xl font-semibold text-[#FAF8F5]">{c.final_title}</h2>
              <p className="mt-4 text-[#B9C9BE]">{c.final_text}</p>
              <Link to="/boutique" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#D4A359] px-6 py-3.5 font-medium text-[#1E3A2B] hover:brightness-105">
                {c.final_cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
