import React from "react";
import { Link } from "react-router-dom";
import { WITHDRAWAL_CONSENT_TEXT } from "@/lib/site";

export const WithdrawalConsent = ({ id, checked, onChange, dark = false }) => (
  <div className={`mt-5 max-w-md text-left text-xs leading-relaxed ${dark ? "text-[#CBD9CE]" : "text-[#2C332E]"}`}>
    <label htmlFor={id} className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={`${id}-checkbox`}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#87A987] accent-[#3B6B4C]"
      />
      <span>{WITHDRAWAL_CONSENT_TEXT}</span>
    </label>
    <p className={`mt-2 ${dark ? "text-[#B9C9BE]" : "text-[#626D66]"}`}>
      En cliquant sur « Acheter », vous acceptez nos{" "}
      <Link to="/cgv" className="underline hover:text-[#3B6B4C]">conditions générales de vente</Link>.
      Vos garanties légales de conformité restent applicables.
    </p>
  </div>
);

export default WithdrawalConsent;
