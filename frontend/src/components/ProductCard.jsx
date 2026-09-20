import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Screenshot } from "@/components/Screenshot";
import { Icon } from "@/components/Icon";
import { formatPrice, t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/api";

export const ProductCard = ({ product, category }) => {
  const coming = product.status === "coming_soon";
  const img = product.main_image ? mediaUrl(product.main_image) : "";
  return (
    <div
      data-testid={`product-card-${product.slug}`}
      className="group card-soft flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(30,58,43,0.28)]"
    >
      <div className="relative p-3">
        <Screenshot url={img} caption={product.name} icon={category?.icon || "Sparkles"} ratio="aspect-[16/11]" />
        <div className="absolute left-5 top-5 flex gap-2">
          {product.badge && !coming && (
            <span className="rounded-full bg-[#1E3A2B] px-3 py-1 text-xs font-semibold text-[#FAF8F5]">{product.badge}</span>
          )}
          {coming && (
            <span className="rounded-full bg-[#D4A359] px-3 py-1 text-xs font-semibold text-white">{t("badge.coming_soon")}</span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-6 pt-2">
        {category && (
          <span className="mb-2 inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#3B6B4C]">
            <Icon name={category.icon} className="h-3.5 w-3.5" /> {category.name}
          </span>
        )}
        <h3 className="font-serif text-xl font-semibold text-[#1E3A2B]">{product.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[#626D66]">{product.short_description}</p>
        <div className="mt-5 flex items-center justify-between">
          {coming ? (
            <span className="text-sm font-medium text-[#87A987]">Bientôt</span>
          ) : (
            <span className="font-serif text-xl font-bold text-[#1E3A2B]">{formatPrice(product.price, product.currency)}</span>
          )}
          {coming ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#F2EDE4] px-4 py-2.5 text-sm font-medium text-[#87A987]">
              {t("badge.coming_soon")}
            </span>
          ) : (
            <Link
              to={`/boutique/${product.slug}`}
              data-testid={`product-cta-${product.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#EAF0EC] px-4 py-2.5 text-sm font-medium text-[#1E3A2B] transition-all duration-200 hover:bg-[#1E3A2B] hover:text-[#FAF8F5]"
            >
              {t("cta.discover")} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
