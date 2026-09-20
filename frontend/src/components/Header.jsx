import React, { useState, useEffect } from "react";
import { Link, useLocation, NavLink } from "react-router-dom";
import { Menu, X, ShoppingBag } from "lucide-react";
import { Logo } from "@/components/Logo";
import { t } from "@/lib/i18n";

const NAV = [
  { to: "/", label: t("nav.home"), end: true },
  { to: "/boutique", label: t("nav.shop") },
  { to: "/ressources", label: t("nav.resources") },
  { to: "/a-propos", label: t("nav.about") },
  { to: "/faq", label: t("nav.faq") },
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled ? "border-[#E2DDD5] bg-[#FAF8F5]/90 backdrop-blur-md" : "border-transparent bg-[#FAF8F5]"
      }`}
    >
      <div className="container-app flex h-[70px] items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" data-testid="desktop-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`nav-${n.to === "/" ? "home" : n.to.slice(1)}`}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-[#1E3A2B]" : "text-[#626D66] hover:text-[#1E3A2B]"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/boutique"
            data-testid="header-shop-btn"
            className="hidden items-center gap-2 rounded-xl bg-[#1E3A2B] px-5 py-2.5 text-sm font-medium text-[#FAF8F5] transition-all duration-200 hover:bg-[#3B6B4C] active:scale-[0.98] sm:inline-flex"
          >
            <ShoppingBag className="h-4 w-4" /> {t("cta.shop")}
          </Link>
          <button
            onClick={() => setOpen(true)}
            data-testid="mobile-menu-open-btn"
            aria-label="Ouvrir le menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#1E3A2B] hover:bg-[#EAF0EC] lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-[70] lg:hidden ${open ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-[#1E3A2B]/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-[#FAF8F5] shadow-2xl transition-transform duration-300 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
          data-testid="mobile-menu-panel"
        >
          <div className="flex h-[70px] items-center justify-between border-b border-[#E2DDD5] px-5">
            <Logo variant="mark" />
            <button onClick={() => setOpen(false)} data-testid="mobile-menu-close-btn" aria-label="Fermer" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#1E3A2B] hover:bg-[#EAF0EC]">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={`mobile-nav-${n.to === "/" ? "home" : n.to.slice(1)}`}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${
                    isActive ? "bg-[#EAF0EC] text-[#1E3A2B]" : "text-[#2C332E] hover:bg-[#F2EDE4]"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <Link to="/contact" className="rounded-xl px-4 py-3.5 text-base font-medium text-[#2C332E] hover:bg-[#F2EDE4]">
              {t("nav.contact")}
            </Link>
          </nav>
          <div className="mt-auto p-5">
            <Link
              to="/boutique"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-5 py-3.5 font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]"
            >
              <ShoppingBag className="h-5 w-5" /> {t("cta.shop")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
