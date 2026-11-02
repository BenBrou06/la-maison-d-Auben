import React from "react";
import { Link } from "react-router-dom";
import { mediaUrl } from "@/lib/api";
import { useContent } from "@/lib/content";

// Logo commun (en-tête, pied de page, admin, favicon) : « Logo du site » dans Pages → En-tête et onglet.
// Sans réglage : logo officiel (public/images/logo-176.png, copie redimensionnée de favicon-default.png).
export const DEFAULT_LOGO = "/images/logo-176.png";
export const useSiteLogo = () => {
  const c = useContent("header");
  return { src: c.favicon ? mediaUrl(c.favicon) : DEFAULT_LOGO, custom: !!c.favicon, c };
};

export const Logo = ({ className = "", variant = "full", onClick }) => {
  const { src, c } = useSiteLogo();
  return (
    <Link to="/" onClick={onClick} className={`inline-flex items-center gap-2.5 ${className}`} data-testid="brand-logo">
      <img src={src} alt={`${c.brand_line1} ${c.brand_line2}`.trim()} className="h-11 w-11 object-contain rounded-lg" data-testid="brand-logo-img" />
      {variant === "full" && (
        <span className="font-serif font-bold text-[#1E3A2B] leading-none text-lg sm:text-xl tracking-tight">
          {c.brand_line1}<br className="hidden sm:block" /> <span className="text-[#3B6B4C]">{c.brand_line2}</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
