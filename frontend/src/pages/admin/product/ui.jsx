import React from "react";
import { Plus } from "lucide-react";
import { ICON_NAMES } from "@/components/Icon";

export const inputCls = "w-full rounded-lg border border-[#E2DDD5] bg-[#FAF8F5] px-3 py-2 text-sm text-[#1E3A2B] focus:border-[#87A987] focus:outline-none disabled:cursor-default disabled:text-[#4A544D]";
export const labelCls = "block text-xs font-medium text-[#626D66] mb-1";
export const helpCls = "text-xs text-[#87A987]";

export const move = (arr, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export function IconBtn({ children, onClick, danger, title, testid }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} data-testid={testid}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${danger ? "border-[#E7C9C4] text-[#B4453A] hover:bg-[#F7ECEA]" : "border-[#E2DDD5] text-[#2C332E] hover:bg-[#EAF0EC]"}`}>
      {children}
    </button>
  );
}

export function AddBtn({ children, onClick, testid }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-2 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
      <Plus className="h-4 w-4" /> {children}
    </button>
  );
}

export function IconSelect({ value, onChange, testid, className = "w-40" }) {
  return (
    <select className={`${inputCls} ${className}`} value={value} data-testid={testid} onChange={(e) => onChange(e.target.value)} aria-label="Icône">
      {ICON_NAMES.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label, testid, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1E3A2B]" checked={!!checked} onChange={(e) => onChange(e.target.checked)} data-testid={testid} />
      <span>
        <span className="text-sm font-medium text-[#1E3A2B]">{label}</span>
        {hint && <span className={`block ${helpCls}`}>{hint}</span>}
      </span>
    </label>
  );
}
