import React from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2, Plus, ImagePlus, RotateCcw } from "lucide-react";
import { adminUploadImage, mediaUrl } from "@/lib/api";

export const inputCls = "w-full rounded-xl border border-[#E2DDD5] bg-white px-3.5 py-2.5 text-sm text-[#2C332E] focus:border-[#3B6B4C] focus:outline-none";
export const btnCls = "inline-flex items-center gap-1.5 rounded-xl border border-[#E2DDD5] bg-white px-3 py-2 text-xs font-medium text-[#1E3A2B] hover:bg-[#FAF8F5] disabled:opacity-50";
export const primaryCls = "inline-flex items-center gap-2 rounded-xl bg-[#1E3A2B] px-5 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:cursor-not-allowed disabled:opacity-50";

export const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export function ImageInput({ value, onChange, testid }) {
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { onChange((await adminUploadImage(file)).path); toast.success("Image envoyée. Pensez à enregistrer."); }
    catch (err) { toast.error(err.response?.data?.detail || "Échec de l'envoi de l'image."); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {value ? <img src={mediaUrl(value)} alt="" className="h-16 w-24 rounded-lg border border-[#E2DDD5] object-cover" /> : null}
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="/images/… ou image envoyée" className={`${inputCls} min-w-0 flex-1`} data-testid={`${testid}-input`} />
      <label className={`${btnCls} cursor-pointer`}>
        <ImagePlus className="h-3.5 w-3.5" /> Envoyer
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="hidden" data-testid={`${testid}-file`} />
      </label>
    </div>
  );
}

export function ListEditor({ value = [], item, fixed, onChange, testid, newItem }) {
  const set = (i, name, v) => onChange(value.map((it, k) => (k === i ? { ...it, [name]: v } : it)));
  return (
    <div className="space-y-3" data-testid={testid}>
      {value.map((it, i) => (
        <div key={i} className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] p-3" data-testid={`${testid}-item-${i}`}>
          <div className="mb-2 flex items-center justify-between text-xs text-[#626D66]">
            <span>#{i + 1}</span>
            {!fixed && (
              <span className="flex gap-1">
                <button type="button" onClick={() => onChange(move(value, i, -1))} className={btnCls} aria-label="Monter" data-testid={`${testid}-up-${i}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onChange(move(value, i, 1))} className={btnCls} aria-label="Descendre" data-testid={`${testid}-down-${i}`}><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className={`${btnCls} text-[#8A2A1F]`} aria-label="Supprimer" data-testid={`${testid}-remove-${i}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            )}
          </div>
          <div className="space-y-2">
            {item.map((f) => (
              <label key={f.name} className="block text-xs font-medium text-[#2C332E]">
                {f.label}
                {f.type === "textarea"
                  ? <textarea rows={f.rows || 3} value={it[f.name] || ""} onChange={(e) => set(i, f.name, e.target.value)} className={`${inputCls} mt-1 font-normal`} data-testid={`${testid}-${i}-${f.name}`} />
                  : <input value={it[f.name] || ""} onChange={(e) => set(i, f.name, e.target.value)} className={`${inputCls} mt-1 font-normal`} data-testid={`${testid}-${i}-${f.name}`} />}
              </label>
            ))}
          </div>
        </div>
      ))}
      {!fixed && (
        <button type="button" onClick={() => onChange([...value, newItem || Object.fromEntries(item.map((f) => [f.name, ""]))])} className={btnCls} data-testid={`${testid}-add`}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      )}
    </div>
  );
}

export const ResetButton = ({ onClick, testid }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[11px] text-[#626D66] hover:text-[#1E3A2B]" data-testid={testid}>
    <RotateCcw className="h-3 w-3" /> Texte d'origine
  </button>
);
