import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tag, ChevronDown } from "lucide-react";
import { adminGetPromotion, adminSavePromotion } from "@/lib/api";
import { formatPrice } from "@/lib/i18n";
import { inputCls, labelCls, helpCls, Toggle } from "@/pages/admin/product/ui";

const STATUS = {
  active: ["En cours : prix réduit affiché et facturé", "bg-[#EAF0EC] text-[#3B6B4C]"],
  scheduled: ["Programmée : pas encore commencée", "bg-[#F6ECD9] text-[#A9772F]"],
  expired: ["Terminée : prix normal", "bg-[#F2EDE4] text-[#626D66]"],
  invalid: ["Invalide avec le prix actuel : prix normal", "bg-[#F7ECEA] text-[#B4453A]"],
  off: ["Aucune promotion", "bg-[#F2EDE4] text-[#626D66]"],
};

// Même calcul que le serveur (centimes, arrondi au plus proche) ; le serveur reste la référence.
export const finalCents = (price, type, value) => {
  const base = Math.round(Number(price) * 100);
  const v = Number(value);
  if (!base || !v) return null;
  let f;
  if (type === "percent") { if (!Number.isInteger(v) || v < 1 || v > 90) return null; f = Math.floor((base * (100 - v) + 50) / 100); }
  else f = base - Math.round(v * 100);
  return f >= 50 && f < base ? f : null;
};

const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);

export function PromotionEditor({ p, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open || form) return;
    adminGetPromotion(p.slug).then((r) => {
      const pr = r.promotion || {};
      setForm({ enabled: !!pr.enabled, type: pr.type || "percent", value: pr.value ?? "", starts_at: toLocal(pr.starts_at), ends_at: toLocal(pr.ends_at) });
      setStatus(r.status);
    }).catch(() => toast.error("Impossible de charger la promotion."));
  }, [open, form, p.slug]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const fc = form && finalCents(p.price, form.type, String(form.value).replace(",", "."));
  const save = async () => {
    setSaving(true);
    try {
      const r = await adminSavePromotion(p.slug, { ...form, value: Number(String(form.value).replace(",", ".")) || 0, starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at) });
      setStatus(r.status);
      toast.success("Promotion enregistrée.");
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || "Échec de l'enregistrement de la promotion."); }
    setSaving(false);
  };
  const [label, cls] = STATUS[status] || STATUS.off;
  return (
    <div className="mt-4 rounded-lg border border-[#E2DDD5]" data-testid={`promo-${p.slug}`}>
      <button type="button" onClick={() => setOpen(!open)} data-testid={`promo-toggle-${p.slug}`} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-[#1E3A2B]">
        <span className="inline-flex items-center gap-2"><Tag className="h-4 w-4 text-[#A9772F]" /> Promotion
          {p.pricing?.active && <span className="rounded-full bg-[#F6ECD9] px-2 py-0.5 text-xs text-[#A9772F]" data-testid={`promo-live-${p.slug}`}>{p.pricing.label} · {formatPrice(p.pricing.final, p.currency)}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && form && (
        <div className="space-y-4 border-t border-[#E2DDD5] px-4 py-4">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${cls}`} data-testid={`promo-status-${p.slug}`}>{label}</span>
          <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label="Activer la promotion" hint="Le prix réduit est affiché partout sur le site et réellement facturé au paiement. Le prix normal n'est pas modifié." testid={`promo-enabled-${p.slug}`} />
          <div className="flex flex-wrap gap-3">
            <div><label className={labelCls}>Type de réduction</label>
              <select className={`${inputCls} w-44`} value={form.type} onChange={(e) => set("type", e.target.value)} data-testid={`promo-type-${p.slug}`}>
                <option value="percent">Pourcentage (%)</option><option value="amount">Montant fixe (€)</option>
              </select></div>
            <div><label className={labelCls}>{form.type === "percent" ? "Réduction (%)" : "Réduction (€)"}</label>
              <input className={`${inputCls} w-28`} inputMode="decimal" value={form.value} onChange={(e) => set("value", e.target.value)} data-testid={`promo-value-${p.slug}`} placeholder={form.type === "percent" ? "20" : "1,50"} /></div>
            <div><label className={labelCls}>Début (facultatif)</label>
              <input type="datetime-local" className={`${inputCls} w-52`} value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} data-testid={`promo-start-${p.slug}`} /></div>
            <div><label className={labelCls}>Fin (facultative)</label>
              <input type="datetime-local" className={`${inputCls} w-52`} value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} data-testid={`promo-end-${p.slug}`} /></div>
          </div>
          <div className="rounded-lg bg-[#FAF8F5] p-3 text-sm" data-testid={`promo-preview-${p.slug}`}>
            {p.price == null ? "Définissez d'abord le prix du produit." : !form.enabled ? <>Promotion désactivée : prix normal <strong className="text-[#1E3A2B]">{formatPrice(p.price, p.currency)}</strong> affiché et facturé.</> : fc == null
              ? <span className="text-[#B4453A]">Réduction invalide : pourcentage entier de 1 à 90, ou montant laissant au moins 0,50 € et inférieur au prix normal.</span>
              : <>Prix normal <s className="text-[#87A987]">{formatPrice(p.price, p.currency)}</s> → prix affiché et facturé <strong className="text-[#1E3A2B]">{formatPrice(fc / 100, p.currency)}</strong></>}
          </div>
          <p className={helpCls}>Sans date de fin, la promotion dure jusqu'à ce que vous la désactiviez. À l'expiration, le prix normal revient automatiquement.</p>
          <button type="button" onClick={save} disabled={saving} data-testid={`promo-save-${p.slug}`} className="rounded-lg bg-[#1E3A2B] px-4 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer la promotion"}
          </button>
        </div>
      )}
    </div>
  );
}
