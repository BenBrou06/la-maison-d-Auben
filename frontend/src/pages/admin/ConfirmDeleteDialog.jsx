import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const WORD = "SUPPRIMER";

// Fenêtre de suppression définitive : l'utilisateur doit taper SUPPRIMER (vérifié aussi côté serveur).
export function ConfirmDeleteDialog({ open, title, description, onCancel, onConfirm, testid = "confirm-delete" }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setTyped(""); onCancel(); };
  const confirm = async () => {
    setBusy(true);
    await onConfirm(typed);
    setBusy(false);
    setTyped("");
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent data-testid={`${testid}-dialog`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description} Cette action est définitive.</DialogDescription>
        </DialogHeader>
        <label className="block text-sm text-[#2C332E]">
          Pour confirmer, tapez <strong>{WORD}</strong>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-testid={`${testid}-input`}
            className="mt-1.5 w-full rounded-xl border border-[#E2DDD5] px-4 py-2.5 focus:border-[#8A2A1F] focus:outline-none" />
        </label>
        <DialogFooter>
          <button onClick={close} className="rounded-xl px-4 py-2.5 text-sm text-[#626D66] hover:bg-[#FAF8F5]" data-testid={`${testid}-cancel`}>Annuler</button>
          <button onClick={confirm} disabled={typed !== WORD || busy} data-testid={`${testid}-submit`}
            className="rounded-xl bg-[#8A2A1F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6F2118] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDeleteDialog;
