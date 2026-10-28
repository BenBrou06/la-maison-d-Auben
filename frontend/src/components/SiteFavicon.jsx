import { useEffect } from "react";
import { mediaUrl } from "@/lib/api";
import { useContent } from "@/lib/content";

const DEFAULTS = { "site-favicon": "/images/favicon-32.png", "site-apple-icon": "/images/apple-touch-icon.png" };

// Applique le favicon choisi dans l'admin (« En-tête et onglet ») ; sinon garde celui d'index.html.
// Chaque image envoyée a une adresse unique : le navigateur ne peut pas réafficher l'ancienne depuis son cache.
export function SiteFavicon() {
  const { favicon } = useContent("header");
  useEffect(() => {
    Object.entries(DEFAULTS).forEach(([id, def]) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("href", favicon ? mediaUrl(favicon) : def);
    });
  }, [favicon]);
  return null;
}

export default SiteFavicon;
