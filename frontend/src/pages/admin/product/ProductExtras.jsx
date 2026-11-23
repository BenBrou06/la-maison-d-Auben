import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { adminReassurance } from "@/lib/api";
import { formatOf, accessOf } from "@/components/ProductSections";
import { inputCls, labelCls, helpCls, move, IconBtn, AddBtn, IconSelect, Toggle } from "@/pages/admin/product/ui";

// Liste titre + texte + icône (bénéfices, éléments de réassurance propres au produit).
export function CardList({ items, onChange, testid, addLabel, titlePh, textPh }) {
  const upd = (i, patch) => { const n = [...items]; n[i] = { ...n[i], ...patch }; onChange(n); };
  return (
    <div>
      <div className="space-y-3">
        {items.map((b, i) => (
          <div key={i} className="rounded-lg border border-[#E2DDD5] p-3" data-testid={`${testid}-${i}`}>
            <div className="flex flex-wrap items-center gap-2">
              <IconSelect value={b.icon || "Sparkles"} onChange={(v) => upd(i, { icon: v })} testid={`${testid}-icon-${i}`} />
              <input className={`${inputCls} min-w-[12rem] flex-1`} placeholder={titlePh} value={b.title || ""} data-testid={`${testid}-title-${i}`} onChange={(e) => upd(i, { title: e.target.value })} />
              <IconBtn onClick={() => onChange(move(items, i, -1))} title="Monter" testid={`${testid}-up-${i}`}><ArrowUp className="h-4 w-4" /></IconBtn>
              <IconBtn onClick={() => onChange(move(items, i, 1))} title="Descendre" testid={`${testid}-down-${i}`}><ArrowDown className="h-4 w-4" /></IconBtn>
              <IconBtn danger onClick={() => onChange(items.filter((_, k) => k !== i))} title="Supprimer" testid={`${testid}-delete-${i}`}><Trash2 className="h-4 w-4" /></IconBtn>
            </div>
            <textarea rows={2} className={`${inputCls} mt-2`} placeholder={textPh} value={b.text || ""} data-testid={`${testid}-text-${i}`} onChange={(e) => upd(i, { text: e.target.value })} />
          </div>
        ))}
      </div>
      <AddBtn testid={`${testid}-add`} onClick={() => onChange([...items, { icon: "Sparkles", title: "", text: "" }])}>{addLabel}</AddBtn>
    </div>
  );
}

export function BenefitsEditor({ items, onChange }) {
  return (
    <>
      <p className={helpCls}>Ce que l'utilisateur y gagne concrètement (distinct des fonctionnalités). N'indiquez que ce que l'outil permet réellement. Section masquée sur le site tant qu'elle est vide.</p>
      <CardList items={items} onChange={onChange} testid="content-benefit" addLabel="Ajouter un bénéfice"
        titlePh="Ex. : Comprenez où part votre argent" textPh="Ex. : Repérez en un coup d'œil les dépenses sur lesquelles vous pouvez agir." />
    </>
  );
}

const PRACTICAL = [
  ["level", "Niveau requis", "Ex. : Aucune connaissance d'Excel nécessaire : il suffit de saisir vos montants."],
  ["license", "Conditions d'utilisation", "Ex. : Usage personnel ; revente et partage du fichier non autorisés."],
  ["limitations", "Limitations à connaître", "Ex. : Les macros ne fonctionnent pas sur Google Sheets."],
];

export function PracticalEditor({ value, onChange, product }) {
  const v = value || {};
  const set = (k, x) => onChange({ ...v, [k]: x });
  return (
    <div className="space-y-4">
      <p className={helpCls}>Affiché près du bouton d'achat et dans « Bon à savoir ». Un champ vide n'apparaît pas sur le site.</p>
      {PRACTICAL.map(([k, label, ph]) => (
        <div key={k}><label className={labelCls}>{label}</label>
          <textarea rows={2} className={inputCls} placeholder={ph} value={v[k] || ""} data-testid={`content-practical-${k}`} onChange={(e) => set(k, e.target.value)} /></div>
      ))}
      <div><label className={labelCls}>Format fourni (laisser vide = automatique)</label>
        <input className={inputCls} placeholder={formatOf({ ...product, practical: {} }) || "Ex. : Classeur Excel (.xlsx)"} value={v.format || ""} data-testid="content-practical-format" onChange={(e) => set("format", e.target.value)} /></div>
      <div><label className={labelCls}>Accès après achat (laisser vide = texte automatique)</label>
        <textarea rows={2} className={inputCls} placeholder={accessOf({ ...product, practical: {} })} value={v.access || ""} data-testid="content-practical-access" onChange={(e) => set("access", e.target.value)} /></div>
    </div>
  );
}

export function ReassuranceExceptions({ hidden, extra, onHidden, onExtra }) {
  const { data } = useQuery({ queryKey: ["admin-reassurance"], queryFn: adminReassurance });
  const common = (data?.items || []).filter((i) => i.enabled);
  return (
    <div className="space-y-4">
      <p className={helpCls}>Les éléments communs se règlent dans l'onglet « Confiance ». Ici, vous pouvez en masquer pour ce produit ou en ajouter un qui lui est propre.</p>
      <div className="space-y-2">
        {common.map((i) => (
          <Toggle key={i.key} checked={!hidden.includes(i.key)} label={i.title} hint={i.text} testid={`content-reassurance-show-${i.key}`}
            onChange={(on) => onHidden(on ? hidden.filter((k) => k !== i.key) : [...hidden, i.key])} />
        ))}
        {!common.length && <p className={helpCls}>Aucun élément commun activé.</p>}
      </div>
      <div>
        <label className={labelCls}>Éléments propres à ce produit</label>
        <CardList items={extra} onChange={onExtra} testid="content-reassurance-extra" addLabel="Ajouter un élément" titlePh="Intitulé" textPh="Courte description" />
      </div>
    </div>
  );
}
