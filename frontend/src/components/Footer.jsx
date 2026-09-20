import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Newsletter } from "@/components/Newsletter";
import { ShieldCheck, Lock, Mail } from "lucide-react";

const COLS = [
  {
    title: "La Maison",
    links: [
      { to: "/", label: "Accueil" },
      { to: "/boutique", label: "Boutique" },
      { to: "/ressources", label: "Ressources" },
      { to: "/a-propos", label: "À propos" },
    ],
  },
  {
    title: "Aide",
    links: [
      { to: "/faq", label: "FAQ" },
      { to: "/contact", label: "Contact" },
      { to: "/produits-numeriques", label: "Produits numériques" },
    ],
  },
  {
    title: "Légal",
    links: [
      { to: "/mentions-legales", label: "Mentions légales" },
      { to: "/cgv", label: "CGV" },
      { to: "/confidentialite", label: "Confidentialité" },
      { to: "/politique-cookies", label: "Cookies" },
    ],
  },
];

export const Footer = () => {
  return (
    <footer className="mt-20 border-t border-[#E2DDD5] bg-[#F2EDE4]">
      <div className="container-app py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#626D66]">
              Des outils numériques simples, beaux et intelligents pour mieux organiser votre vie et vos projets.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-[#3B6B4C]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5"><Lock className="h-3.5 w-3.5" /> Paiement sécurisé</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Téléchargement protégé</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLS.map((col) => (
              <div key={col.title}>
                <h4 className="mb-3 text-sm font-semibold text-[#1E3A2B]">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-sm text-[#626D66] transition-colors hover:text-[#1E3A2B]">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-3xl bg-[#1E3A2B] p-8 grain sm:p-10">
          <div className="relative z-10 grid gap-6 lg:grid-cols-2 lg:items-center">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-[#FAF8F5] sm:text-3xl">
                Recevez nos nouveaux outils et ressources gratuitement.
              </h3>
              <p className="mt-3 flex items-center gap-2 text-sm text-[#B9C9BE]">
                <Mail className="h-4 w-4" /> Pas de spam, juste nos meilleures idées et nos nouveautés.
              </p>
            </div>
            <Newsletter compact />
          </div>
        </div>
      </div>

      <div className="border-t border-[#E2DDD5]/70">
        <div className="container-app flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
          <p className="text-xs text-[#626D66]">© {new Date().getFullYear()} La Maison d'Auben. Tous droits réservés.</p>
          <p className="text-xs italic text-[#87A987]">L'aubaine pour mieux s'organiser.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
