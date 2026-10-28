import React from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";

export default function NotFound() {
  return (
    <div className="container-app py-24 text-center" data-testid="not-found-page">
      <Seo title="Page introuvable — La Maison d'Auben" description="Cette page n'existe pas ou plus." noindex />
      <h1 className="font-serif text-4xl font-bold text-[#1E3A2B]">Page introuvable</h1>
      <p className="mt-4 text-[#626D66]">Cette page n'existe pas ou plus.</p>
      <Link to="/" className="mt-8 inline-flex rounded-xl bg-[#1E3A2B] px-5 py-3 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]" data-testid="not-found-home-link">
        Retour à l'accueil
      </Link>
    </div>
  );
}
