import React from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

// Emplacement propre du logo officiel — remplacer /src/assets/logo.png suffit.
export const Logo = ({ className = "", variant = "full", onClick }) => {
  return (
    <Link to="/" onClick={onClick} className={`inline-flex items-center gap-2.5 ${className}`} data-testid="brand-logo">
      <img src={logo} alt="La Maison d'Auben" className="h-11 w-11 object-contain rounded-lg" />
      {variant === "full" && (
        <span className="font-serif font-bold text-[#1E3A2B] leading-none text-lg sm:text-xl tracking-tight">
          La Maison<br className="hidden sm:block" /> <span className="text-[#3B6B4C]">d'Auben</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
