import React, { useState } from "react";
import { toast } from "sonner";
import { Trash2, Undo2, XCircle } from "lucide-react";
import { adminNewsletterRemove, adminNewsletterRestore, adminNewsletterPurge } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/pages/admin/ConfirmDeleteDialog";
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
  s.consent_valid
    ? <Pill tone="green" testid={`sub-consent-${s.id}`}>Consentement prouvé</Pill>
    : <Pill tone="amber" testid={`sub-consent-${s.id}`}>Consentement non prouvé</Pill>;

function SubscriberRow({ s, checked, onToggle, onRemove, onRestore, onPurge }) {
  return (
    <li className="rounded-lg bg-[#FAF8F5] px-4 py-3 text-sm" data-testid={`admin-newsletter-item-${s.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`w-full min-w-0 [overflow-wrap:anywhere] sm:w-auto sm:flex-1 ${s.eligible ? "text-[#2C332E]" : "text-[#626D66]"}`}>{s.email}</span>
        {statusPill(s)}{consentPill(s)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#626D66]">
        {s.eligible && (
          <label className="flex items-center gap-1.5 font-medium text-[#1E3A2B]">
            <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Sélectionner ${s.email} comme destinataire`}
              data-testid={`sub-select-${s.id}`} className="h-4 w-4 accent-[#3B6B4C]" />
            Destinataire
          </label>
        )}
        <span>Consentement : {fmtDate(s.consent_at)}{s.consent_text_version ? ` (${s.consent_text_version})` : ""}</span>
        {s.unsubscribed_at && <span>Désinscrit : {fmtDate(s.unsubscribed_at)}</span>}
        {s.removed_at && <span>Retiré : {fmtDate(s.removed_at)}</span>}
        {!s.eligible && <span className="text-[#8A2A1F]" data-testid={`sub-ineligible-${s.id}`}>Exclu : {s.ineligible_reason}</span>}
        {s.removed ? (
          <button onClick={() => onRestore(s)} className="inline-flex items-center gap-1 text-[#3B6B4C] hover:underline" data-testid={`sub-restore-btn-${s.id}`}>
            <Undo2 className="h-3.5 w-3.5" /> Restaurer
          </button>
        ) : (
          <button onClick={() => onRemove(s)} className="inline-flex items-center gap-1 text-[#8A2A1F] hover:underline" data-testid={`sub-remove-btn-${s.id}`}>
            <XCircle className="h-3.5 w-3.5" /> Retirer
          </button>
        )}
        <button onClick={() => onPurge(s)} className="inline-flex items-center gap-1 text-[#8A2A1F] hover:underline" data-testid={`sub-purge-btn-${s.id}`}>
          <Trash2 className="h-3.5 w-3.5" /> Supprimer définitivement
        </button>
      </div>
    </li>
  );
}

export function SubscriberList({ subs, selected, setSelected, onChange }) {
  const [showHidden, setShowHidden] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [toPurge, setToPurge] = useState(null);
  const restore = async (sub) => {
    try { await adminNewsletterRestore(sub.id); toast.success("Abonné restauré."); onChange(); }
    catch { toast.error("Restauration impossible."); }
  };
  const purge = async (word) => {
    try {
      await adminNewsletterPurge(toPurge.id, word);
      toast.success("Abonné supprimé définitivement.");
      const next = new Set(selected); next.delete(toPurge.id); setSelected(next);
      onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "Suppression impossible."); }
    setToPurge(null);
  };
  const visible = subs.filter((s) => showHidden || !s.removed);
  const eligibleIds = subs.filter((s) => s.eligible).map((s) => s.id);
  const eligibleCount = eligibleIds.length;
  const allSelected = eligibleCount > 0 && eligibleIds.every((id) => selected.has(id));
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
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
          <span className="text-xs text-[#626D66]" data-testid="newsletter-selected-count">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <button onClick={() => setSelected(allSelected ? new Set() : new Set(eligibleIds))} disabled={eligibleCount === 0}
            data-testid="newsletter-toggle-select-all" className="rounded-lg border border-[#E2DDD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1E3A2B] hover:bg-[#FAF8F5] disabled:opacity-50">
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
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
            <SubscriberRow key={s.id} s={s} checked={selected.has(s.id)} onToggle={() => toggle(s.id)} onRemove={setToRemove} onRestore={restore} onPurge={setToPurge} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-[#626D66]">
        Seules les adresses sélectionnées, inscrites, avec consentement prouvé (date et version du texte) et non retirées reçoivent la newsletter. Le serveur vérifie à nouveau chaque adresse au moment de l'envoi.
      </p>
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent data-testid="remove-subscriber-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer cet abonné ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.email} ne recevra plus aucune newsletter. Sa preuve de consentement et ses dates sont conservées. Vous pourrez le restaurer via « Afficher les retirés ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="remove-subscriber-cancel">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} data-testid="remove-subscriber-confirm" className="bg-[#8A2A1F] hover:bg-[#6F2118]">Retirer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmDeleteDialog
        open={!!toPurge} testid="purge-subscriber"
        title="Supprimer définitivement cet abonné ?"
        description={`${toPurge?.email || ""} et sa preuve de consentement seront effacés. La même adresse pourra se réinscrire plus tard.`}
        onCancel={() => setToPurge(null)} onConfirm={purge}
      />
    </Card>
  );
}
