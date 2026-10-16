import React, { useState } from "react";
import { toast } from "sonner";
import { adminNewsletterSend } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmSendDialog({ open, onOpenChange, subject, body, recipientCount, allEligible, selectedIds, confirmWord, dryRun, onSent }) {
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const close = (o) => { if (!o) setTyped(""); onOpenChange(o); };

  const send = async () => {
    setSending(true);
    try {
      const r = await adminNewsletterSend({
        subject, body, all_eligible: allEligible, recipient_ids: allEligible ? [] : selectedIds, confirmation: typed,
      });
      toast.success(`Envoi lancé vers ${r.recipients} destinataire(s)${r.mode === "dry_run" ? " — simulation" : ""}.`);
      close(false);
      onSent();
    } catch (e) { toast.error(e.response?.data?.detail || "Envoi impossible."); }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent data-testid="newsletter-confirm-dialog">
        <DialogHeader>
          <DialogTitle>Confirmer l'envoi</DialogTitle>
          <DialogDescription>Vérifiez le récapitulatif. Chaque destinataire reçoit un e-mail individuel avec son propre lien de désinscription.</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 rounded-xl bg-[#FAF8F5] p-4 text-sm">
          <div><dt className="text-xs text-[#626D66]">Objet</dt><dd className="font-medium text-[#1E3A2B]" data-testid="confirm-subject">{subject}</dd></div>
          <div><dt className="text-xs text-[#626D66]">Destinataires</dt><dd className="font-medium text-[#1E3A2B]" data-testid="confirm-recipient-count">{recipientCount} {allEligible ? "(tous les abonnés éligibles)" : "(sélection)"}</dd></div>
          {dryRun && <div className="text-xs text-[#6B4E1F]">Mode simulation : aucun e-mail ne sera réellement envoyé.</div>}
        </dl>
        <label className="block text-sm text-[#2C332E]">
          Pour confirmer, tapez <strong>{confirmWord}</strong>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-testid="confirm-word-input"
            className="mt-1.5 w-full rounded-xl border border-[#E2DDD5] px-4 py-2.5 focus:border-[#3B6B4C] focus:outline-none" />
        </label>
        <DialogFooter>
          <button onClick={() => close(false)} className="rounded-xl px-4 py-2.5 text-sm text-[#626D66] hover:bg-[#FAF8F5]" data-testid="confirm-cancel-btn">Annuler</button>
          <button onClick={send} disabled={typed !== confirmWord || sending} data-testid="confirm-send-btn"
            className="rounded-xl bg-[#1E3A2B] px-5 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:cursor-not-allowed disabled:opacity-50">
            {sending ? "Envoi…" : "Envoyer définitivement"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
