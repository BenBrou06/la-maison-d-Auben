import React, { useState } from "react";
import { Send, Check } from "lucide-react";
import { toast } from "sonner";
import { subscribeNewsletter } from "@/lib/api";
import { t } from "@/lib/i18n";

export const Newsletter = ({ title, text, compact = false }) => {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Merci de cocher le consentement.");
      return;
    }
    setLoading(true);
    try {
      const res = await subscribeNewsletter({ email, consent });
      setDone(true);
      toast.success(res.message || "Merci pour votre inscription !");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? "" : "relative overflow-hidden rounded-3xl bg-[#1E3A2B] p-8 sm:p-12 grain"}>
      {!compact && (
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-2xl font-semibold text-[#FAF8F5] sm:text-3xl lg:text-4xl">
            {title || t("newsletter.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#B9C9BE]">{text}</p>
        </div>
      )}
      {done ? (
        <div className={`relative z-10 mx-auto mt-7 flex max-w-md items-center justify-center gap-2 rounded-xl bg-[#EAF0EC] px-5 py-4 text-[#1E3A2B] ${compact ? "" : ""}`} data-testid="newsletter-success">
          <Check className="h-5 w-5" /> <span className="font-medium">Merci ! Vous êtes bien inscrit·e.</span>
        </div>
      ) : (
        <form onSubmit={submit} className={`relative z-10 mx-auto mt-7 ${compact ? "" : "max-w-md"}`} data-testid="newsletter-form">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              data-testid="newsletter-email-input"
              className="w-full rounded-xl border border-[#E2DDD5] bg-white px-4 py-3.5 text-[#2C332E] placeholder-[#626D66]/60 focus:outline-none focus:ring-2 focus:ring-[#87A987]"
            />
            <button
              type="submit"
              disabled={loading}
              data-testid="newsletter-submit-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4A359] px-6 py-3.5 font-medium text-[#1E3A2B] transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "…" : <>{t("newsletter.cta")} <Send className="h-4 w-4" /></>}
            </button>
          </div>
          <label className={`mt-3 flex items-start gap-2 text-xs ${compact ? "text-[#626D66]" : "text-[#B9C9BE]"}`}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              data-testid="newsletter-consent-checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[#87A987] accent-[#3B6B4C]"
            />
            <span>{t("newsletter.consent")}</span>
          </label>
        </form>
      )}
    </div>
  );
};

export default Newsletter;
