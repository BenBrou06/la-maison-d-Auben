import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

export const CookieBanner = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("auben_cookie_consent")) {
      const timer = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);
  const choose = (value) => {
    localStorage.setItem("auben_cookie_consent", value);
    setShow(false);
  };
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md" data-testid="cookie-banner">
      <div className="card-soft flex flex-col gap-4 p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-[#3B6B4C]" />
          <p className="text-sm leading-relaxed text-[#2C332E]">
            Nous utilisons uniquement les cookies nécessaires au bon fonctionnement du site. Vous pouvez accepter les cookies de mesure d'audience.{" "}
            <Link to="/politique-cookies" className="underline hover:text-[#3B6B4C]">En savoir plus</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => choose("essential")} data-testid="cookie-refuse-btn" className="flex-1 rounded-xl border border-[#E2DDD5] px-4 py-2.5 text-sm font-medium text-[#1E3A2B] hover:bg-[#F2EDE4]">
            Nécessaires uniquement
          </button>
          <button onClick={() => choose("all")} data-testid="cookie-accept-btn" className="flex-1 rounded-xl bg-[#1E3A2B] px-4 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]">
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
