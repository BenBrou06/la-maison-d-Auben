import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { getFaq } from "@/lib/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Faq() {
  const { data: faq = [] } = useQuery({ queryKey: ["faq"], queryFn: getFaq });
  return (
    <>
      <Seo title="FAQ — La Maison d'Auben" description="Questions fréquentes sur nos produits numériques, le paiement et le téléchargement." path="/faq" />
      <section className="border-b border-[#E2DDD5] bg-[#F2EDE4]">
        <div className="container-app py-12 sm:py-16">
          <Reveal>
            <span className="eyebrow">FAQ</span>
            <h1 className="mt-3 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">Vos questions, nos réponses</h1>
          </Reveal>
        </div>
      </section>
      <div className="container-app mx-auto max-w-3xl py-12">
        <Reveal>
          <Accordion type="single" collapsible data-testid="faq-accordion">
            {faq.map((f, i) => (
              <AccordionItem key={f.id || i} value={`item-${i}`} className="mb-3 rounded-xl border border-[#E2DDD5] bg-white px-5">
                <AccordionTrigger className="text-left font-medium text-[#1E3A2B] hover:no-underline">{f.question}</AccordionTrigger>
                <AccordionContent className="text-[#626D66]">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </>
  );
}
