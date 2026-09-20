import React from "react";
import { Icon } from "@/components/Icon";
import { ImageOff } from "lucide-react";

// Cadre placeholder ÉLÉGANT et clairement identifié pour les vraies captures Excel.
// Remplaçable facilement : dès qu'une image (url) est fournie, elle s'affiche.
export const Screenshot = ({ url, caption, icon = "BarChart3", className = "", ratio = "aspect-[16/10]" }) => {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-[#E2DDD5] bg-white ${ratio} ${className}`}>
      {url ? (
        <img src={url} alt={caption || "Capture du produit"} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#EAF0EC] to-[#F2EDE4] p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-[#3B6B4C]">
            <Icon name={icon} className="h-7 w-7" />
          </div>
          <div>
            <p className="font-serif text-lg text-[#1E3A2B]">{caption || "Aperçu"}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#87A987]">
              <ImageOff className="h-3.5 w-3.5" /> Capture à venir
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Mockup ordinateur portable pour présenter le visuel principal.
export const LaptopMockup = ({ url, caption, className = "" }) => (
  <div className={`relative ${className}`}>
    <div className="rounded-t-2xl border border-[#E2DDD5] bg-[#1E3A2B] p-2.5 shadow-[0_24px_60px_-20px_rgba(30,58,43,0.45)]">
      <div className="mb-2 flex gap-1.5 px-1">
        <span className="h-2.5 w-2.5 rounded-full bg-[#87A987]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#D4A359]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3B6B4C]" />
      </div>
      <Screenshot url={url} caption={caption} icon="BarChart3" ratio="aspect-[16/10]" />
    </div>
    <div className="mx-auto h-3 w-[112%] -translate-x-[5%] rounded-b-2xl bg-[#16281d]" />
    <div className="mx-auto h-1.5 w-1/3 rounded-b-xl bg-[#0f1d15]" />
  </div>
);

export default Screenshot;
