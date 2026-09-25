import { useEffect } from "react";

// SEO léger sans dépendance : titre, meta description, canonical, OG.
export const Seo = ({ title, description, image, path, noindex = false }) => {
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
    if (image) set('meta[property="og:image"]', "content", image);

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
    canonical.setAttribute("href", window.location.origin + (path || window.location.pathname));
  }, [title, description, image, path, noindex]);
  return null;
};

export default Seo;
