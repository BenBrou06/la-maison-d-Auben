import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { ProductCard } from "@/components/ProductCard";
import { Icon } from "@/components/Icon";
import { getProducts, getCategories } from "@/lib/api";

export default function Boutique() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("");
  const activeCat = params.get("categorie") || "all";

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.slug, c])), [categories]);

  const setCat = (slug) => {
    if (slug === "all") params.delete("categorie");
    else params.set("categorie", slug);
    setParams(params, { replace: true });
  };

  const filtered = useMemo(() => {
    let list = [...products];
    if (activeCat !== "all") list = list.filter((p) => p.category_slug === activeCat);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s) || (p.short_description || "").toLowerCase().includes(s));
    }
    const order = { available: 0, coming_soon: 1 };
    list.sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2));
    if (sort === "price_asc") list.sort((a, b) => (a.price ?? 9999) - (b.price ?? 9999));
    if (sort === "price_desc") list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    return list;
  }, [products, activeCat, q, sort]);

  return (
    <>
      <Seo
        title="Boutique — La Maison d'Auben"
        description="Découvrez tous nos outils numériques pour mieux organiser votre budget, vos voyages, votre maison et vos projets."
        path="/boutique"
      />

      <section className="border-b border-[#E2DDD5] bg-[#F2EDE4]">
        <div className="container-app py-12 sm:py-16">
          <Reveal>
            <span className="eyebrow">Boutique</span>
            <h1 className="mt-3 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">Tous nos outils</h1>
            <p className="mt-4 max-w-xl text-[#626D66]">
              Des outils simples et beaux, conçus pour vous faciliter le quotidien. Filtrez par univers ou cherchez votre besoin.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="container-app py-10">
        {/* Barre de recherche + tri */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#87A987]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un outil…"
              data-testid="shop-search-input"
              className="w-full rounded-xl border border-[#E2DDD5] bg-white py-3 pl-10 pr-4 text-sm text-[#2C332E] focus:outline-none focus:ring-2 focus:ring-[#87A987]"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#626D66]" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              data-testid="shop-sort-select"
              className="rounded-xl border border-[#E2DDD5] bg-white px-3 py-3 text-sm text-[#2C332E] focus:outline-none focus:ring-2 focus:ring-[#87A987]"
            >
              <option value="">Trier par</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
        </div>

        {/* Filtres catégories */}
        <div className="mt-6 flex flex-wrap gap-2" data-testid="shop-category-filters">
          <button
            onClick={() => setCat("all")}
            data-testid="filter-all"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCat === "all" ? "bg-[#1E3A2B] text-[#FAF8F5]" : "border border-[#E2DDD5] bg-white text-[#2C332E] hover:border-[#87A987]"
            }`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCat(c.slug)}
              data-testid={`filter-${c.slug}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeCat === c.slug ? "bg-[#1E3A2B] text-[#FAF8F5]" : "border border-[#E2DDD5] bg-white text-[#2C332E] hover:border-[#87A987]"
              }`}
            >
              <Icon name={c.icon} className="h-3.5 w-3.5" /> {c.name}
            </button>
          ))}
        </div>

        {/* Grille produits */}
        {filtered.length === 0 ? (
          <div className="mt-16 text-center" data-testid="shop-empty-state">
            <p className="font-serif text-xl text-[#1E3A2B]">Aucun outil ne correspond à votre recherche.</p>
            <p className="mt-2 text-[#626D66]">Essayez un autre mot-clé ou une autre catégorie.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="shop-product-grid">
            {filtered.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 3) * 0.06}>
                <ProductCard product={p} category={catMap[p.category_slug]} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
