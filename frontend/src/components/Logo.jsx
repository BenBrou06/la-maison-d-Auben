import React from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useContent } from "@/lib/content";

// Emplacement propre du logo officiel — remplacer /src/assets/logo.png suffit. Nom modifiable dans l'admin (« En-tête et onglet »).
export const Logo = ({ className = "", variant = "full", onClick }) => {
  const c = useContent("header");
  return (
    <Link to="/" onClick={onClick} className={`inline-flex items-center gap-2.5 ${className}`} data-testid="brand-logo">
      <img src={logo} alt={`${c.brand_line1} ${c.brand_line2}`.trim()} className="h-11 w-11 object-contain rounded-lg" />
      {variant === "full" && (
        <span className="font-serif font-bold text-[#1E3A2B] leading-none text-lg sm:text-xl tracking-tight">
          {c.brand_line1}<br className="hidden sm:block" /> <span className="text-[#3B6B4C]">{c.brand_line2}</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
