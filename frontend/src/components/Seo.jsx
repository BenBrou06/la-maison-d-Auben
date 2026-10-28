import { useEffect } from "react";
import { SITE_URL } from "@/lib/site";

// SEO léger sans dépendance : titre, meta description, canonical, OG.
export const Seo = ({ title, description, image, path, noindex = false, jsonLd = null }) => {
  useEffect(() => {
    if (title) document.title = title;
    const set = (selector, attr, value) => {
      if (!value) return;
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const [k, v] = selector.replace(/meta\[|\]/g, "").split("=");
        el.setAttribute(k, v.replace(/["']/g, ""));
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };
    set('meta[name="description"]', "content", description);
    set('meta[property="og:title"]', "content", title);
    set('meta[property="og:description"]', "content", description);
    if (image) set('meta[property="og:image"]', "content", image.startsWith("/") ? SITE_URL + image : image);

    // Pages sensibles (téléchargement/confirmation) : ne pas indexer.
    let robots = document.head.querySelector('meta[name="robots"]');
    if (noindex) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.setAttribute("name", "robots");
        document.head.appendChild(robots);
      }
      robots.setAttribute("content", "noindex, nofollow");
    } else if (robots) {
      robots.setAttribute("content", "index, follow");
    }

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", SITE_URL + (path || window.location.pathname));
    set('meta[property="og:url"]', "content", SITE_URL + (path || window.location.pathname));
  }, [title, description, image, path, noindex]);

  // Données structurées propres à la page (une seule balise, retirée en quittant la page).
  const ld = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    if (!ld) return undefined;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "seo-jsonld";
    el.text = ld.replace(/</g, "\\u003c");
    document.getElementById("seo-jsonld")?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [ld]);
  return null;
};

export default Seo;
