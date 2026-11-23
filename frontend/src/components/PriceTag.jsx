import React from "react";
import { formatPrice } from "@/lib/i18n";

const SIZES = {
  sm: { final: "text-xl", base: "text-sm" },
  md: { final: "text-3xl", base: "text-base" },
  lg: { final: "text-4xl", base: "text-lg" },
};

// Prix calculé par le serveur (pricing) : prix normal barré + badge si une promotion est active.
export const PriceTag = ({ product, size = "md", dark = false, testid = "price" }) => {
  const pr = product.pricing || { final: product.price, base: product.price, active: false };
  const s = SIZES[size];
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1" data-testid={testid}>
      <span className={`font-serif font-bold ${s.final} ${dark ? "text-[#D4A359]" : "text-[#1E3A2B]"}`} data-testid={`${testid}-final`}>
        {formatPrice(pr.final, product.currency)}
      </span>
      {pr.active && (
        <>
          <s className={`${s.base} ${dark ? "text-[#CBD9CE]/70" : "text-[#87A987]"}`} data-testid={`${testid}-base`}>
            {formatPrice(pr.base, product.currency)}
          </s>
          <span className={`self-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${dark ? "bg-[#D4A359] text-[#1E3A2B]" : "bg-[#F6ECD9] text-[#A9772F]"}`} data-testid={`${testid}-badge`}>
            {pr.label}
          </span>
        </>
      )}
    </span>
  );
};

export const promoEnds = (product) => {
  const end = product.pricing?.active && product.pricing.ends_at;
  if (!end) return "";
  return `Offre valable jusqu'au ${new Date(end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`;
};

export default PriceTag;
