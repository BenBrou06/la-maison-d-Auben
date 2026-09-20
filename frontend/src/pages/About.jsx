import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Heart, Leaf } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";

const VALUES = [
  { icon: Sparkles, title: "Beau & utile", text: "Nous croyons qu'un outil bien conçu donne envie de s'en servir — et change vraiment le quotidien." },
  { icon: Heart, title: "Humain avant tout", text: "Derrière chaque produit, deux personnes qui créent des outils qu'elles auraient aimé avoir." },
  { icon: Leaf, title: "Qui grandit", text: "La Maison démarre avec le budget, mais s'agrandira au fil des projets de vie." },
];

export default function About() {
  return (
    <>
      <Seo title="À propos — La Maison d'Auben" description="L'histoire de La Maison d'Auben : Aurélie + Ben, et l'envie de créer de bons outils." path="/a-propos" />

      <section className="container-app py-14 sm:py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Notre histoire</span>
          <h1 className="mt-4 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl lg:text-6xl">
            Aurélie + Ben = <span className="text-[#3B6B4C]">Auben</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#626D66]">
            La Maison d'Auben est née d'une idée simple : et si mieux s'organiser pouvait aussi être agréable ?
            Une belle aubaine pour reprendre la main sur son quotidien.
          </p>
        </Reveal>
      </section>

      <section className="bg-[#F2EDE4] py-14 sm:py-20">
        <div className="container-app grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <img
              src="https://images.unsplash.com/photo-1736576660063-854d978613cd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"
              alt="Un bureau chaleureux"
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_18px_40px_-18px_rgba(30,58,43,0.3)]"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-serif text-3xl font-semibold text-[#1E3A2B] sm:text-4xl">Pourquoi la Maison existe</h2>
            <div className="mt-5 space-y-4 text-[#626D66]">
              <p>Nous avons cherché des outils simples pour gérer notre budget, préparer nos voyages, organiser notre foyer. Trop souvent : soit trop compliqués, soit trop moches, soit les deux.</p>
              <p>Alors nous avons décidé de les créer nous-mêmes. Des outils numériques pensés pour la vraie vie, accessibles à tous — pas seulement aux experts d'Excel.</p>
              <p>La Maison d'Auben, c'est cet endroit où l'on rassemble ces outils, un par un, avec le même soin.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-app py-14 sm:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.08}>
              <div className="card-soft h-full p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#3B6B4C]"><v.icon className="h-6 w-6" strokeWidth={1.75} /></div>
                <h3 className="mt-5 font-serif text-xl font-semibold text-[#1E3A2B]">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#626D66]">{v.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-app pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#1E3A2B] p-10 text-center grain sm:p-14">
            <div className="relative z-10 mx-auto max-w-xl">
              <h2 className="font-serif text-3xl font-semibold text-[#FAF8F5]">Ce que la Maison veut devenir</h2>
              <p className="mt-4 text-[#B9C9BE]">Un univers d'outils beaux et utiles pour chaque projet de vie. Le budget aujourd'hui, bien plus demain.</p>
              <Link to="/boutique" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#D4A359] px-6 py-3.5 font-medium text-[#1E3A2B] hover:brightness-105">
                Voir la boutique <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
