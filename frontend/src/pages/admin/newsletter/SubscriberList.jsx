import React, { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { adminNewsletterPatch, adminNewsletterRemove } from "@/lib/api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, Pill, fmtDate } from "@/pages/admin/newsletter/ui";

const statusPill = (s) => {
  if (s.removed) return <Pill tone="grey" testid={`sub-status-${s.id}`}>Retiré</Pill>;
  if (s.status === "unsubscribed") return <Pill tone="red" testid={`sub-status-${s.id}`}>Désinscrit</Pill>;
  return <Pill tone="green" testid={`sub-status-${s.id}`}>Inscrit</Pill>;
};

const consentPill = (s) =>
  s.consent === true && s.consent_at && s.consent_text_version
    ? <Pill tone="green" testid={`sub-consent-${s.id}`}>Consentement prouvé</Pill>
    : <Pill tone="amber" testid={`sub-consent-${s.id}`}>Consentement non prouvé</Pill>;

function SubscriberRow({ s, checked, onToggle, onRemove, onChange }) {
  const toggleTest = async () => {
    try { await adminNewsletterPatch(s.id, { is_test: !s.is_test }); onChange(); }
    catch { toast.error("Mise à jour impossible."); }
  };
  return (
    <li className="rounded-lg bg-[#FAF8F5] px-4 py-3 text-sm" data-testid={`admin-newsletter-item-${s.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="checkbox" checked={checked} disabled={!s.eligible} onChange={onToggle}
          aria-label={`Sélectionner ${s.email}`} data-testid={`sub-select-${s.id}`}
          className="h-4 w-4 accent-[#3B6B4C] disabled:opacity-40"
        />
        <span className={`min-w-0 flex-1 break-all ${s.eligible ? "text-[#2C332E]" : "text-[#626D66]"}`}>{s.email}</span>
        {statusPill(s)}{consentPill(s)}
        {s.is_test && <Pill tone="amber" testid={`sub-test-badge-${s.id}`}>Test</Pill>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-7 text-xs text-[#626D66]">
        <span>Consentement : {fmtDate(s.consent_at)}{s.consent_text_version ? ` (${s.consent_text_version})` : ""}</span>
        {s.unsubscribed_at && <span>Désinscrit : {fmtDate(s.unsubscribed_at)}</span>}
        {s.removed_at && <span>Retiré : {fmtDate(s.removed_at)}</span>}
        {!s.eligible && <span className="text-[#8A2A1F]" data-testid={`sub-ineligible-${s.id}`}>Exclu : {s.ineligible_reason}</span>}
        {!s.removed && (
          <>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!s.is_test} onChange={toggleTest} data-testid={`sub-mark-test-${s.id}`} className="h-3.5 w-3.5 accent-[#D4A359]" />
              Adresse de test
            </label>
            <button onClick={() => onRemove(s)} className="inline-flex items-center gap-1 text-[#8A2A1F] hover:underline" data-testid={`sub-remove-btn-${s.id}`}>
              <Trash2 className="h-3.5 w-3.5" /> Retirer
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export function SubscriberList({ subs, selected, setSelected, allEligible, setAllEligible, onChange }) {
  const [showHidden, setShowHidden] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const visible = subs.filter((s) => showHidden || !s.removed);
  const eligibleCount = subs.filter((s) => s.eligible).length;
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    setAllEligible(false);
  };
  const confirmRemove = async () => {
    try {
      await adminNewsletterRemove(toRemove.id);
      toast.success("Abonné retiré de la liste active.");
      const next = new Set(selected); next.delete(toRemove.id); setSelected(next);
      onChange();
    } catch { toast.error("Retrait impossible."); }
    setToRemove(null);
  };
  return (
    <Card
      testid="newsletter-subscribers-card"
      title={`Abonnés (${eligibleCount} éligibles / ${subs.filter((s) => !s.removed).length} dans la liste)`}
      right={
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#2C332E]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allEligible} onChange={(e) => { setAllEligible(e.target.checked); setSelected(new Set()); }}
              data-testid="newsletter-select-all-eligible" className="h-4 w-4 accent-[#3B6B4C]" />
            Tous les abonnés éligibles
          </label>
          <label className="flex items-center gap-2 text-xs text-[#626D66]">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} data-testid="newsletter-show-removed" className="h-3.5 w-3.5" />
            Afficher les retirés
          </label>
        </div>
      }
    >
      {visible.length === 0 ? <p className="text-sm text-[#626D66]">Aucun abonné pour le moment.</p> : (
        <ul className="space-y-2" data-testid="admin-newsletter-list">
          {visible.map((s) => (
            <SubscriberRow key={s.id} s={s} checked={allEligible ? s.eligible : selected.has(s.id)}
              onToggle={() => toggle(s.id)} onRemove={setToRemove} onChange={onChange} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-[#626D66]">
        Seules les adresses inscrites, avec consentement prouvé (date et version du texte), non retirées et non marquées « test » peuvent recevoir une newsletter. Le serveur vérifie à nouveau chaque adresse au moment de l'envoi.
      </p>
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent data-testid="remove-subscriber-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer cet abonné ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.email} ne recevra plus aucune newsletter. Sa preuve de consentement et ses dates sont conservées. Cette action ne peut pas être annulée depuis l'interface.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="remove-subscriber-cancel">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} data-testid="remove-subscriber-confirm" className="bg-[#8A2A1F] hover:bg-[#6F2118]">Retirer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
