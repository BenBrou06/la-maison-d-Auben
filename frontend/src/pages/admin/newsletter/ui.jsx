import React from "react";

export const Card = ({ title, right, children, testid }) => (
  <div className="card-soft overflow-hidden p-6" data-testid={testid}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">{title}</h2>
      {right}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const TONES = {
  green: "bg-[#E7F0E9] text-[#1E3A2B]",
  grey: "bg-[#EEEAE4] text-[#626D66]",
  amber: "bg-[#FBF3E4] text-[#6B4E1F]",
  red: "bg-[#FBE9E7] text-[#8A2A1F]",
};

export const Pill = ({ tone = "grey", children, testid }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`} data-testid={testid}>
    {children}
  </span>
);

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
