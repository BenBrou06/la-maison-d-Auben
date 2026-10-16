import React, { useState } from "react";
import { toast } from "sonner";
import { Eye, Send, FlaskConical } from "lucide-react";
import { adminNewsletterPreview, adminNewsletterTest } from "@/lib/api";
import { Card } from "@/pages/admin/newsletter/ui";
import { ConfirmSendDialog } from "@/pages/admin/newsletter/ConfirmSendDialog";

const btn = "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function Composer({ settings, recipientCount, allEligible, selectedIds, onSent, onTested }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ready = subject.trim() && body.trim();

  const preview = async () => {
    try { setPreviewHtml((await adminNewsletterPreview({ subject, body })).html); }
    catch { toast.error("Aperçu impossible."); }
  };
  const sendTest = async () => {
    setBusy(true);
    try {
      const r = await adminNewsletterTest({ subject, body });
      toast.success(r.status === "simulated" ? "Test simulé (aucun e-mail envoyé)." : "Test envoyé à votre adresse vendeur.");
      onTested();
    } catch (e) { toast.error(e.response?.data?.detail || "Envoi du test impossible."); }
    setBusy(false);
  };

  return (
    <Card title="Nouvelle newsletter" testid="newsletter-composer-card">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[#2C332E]">
            Objet
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} data-testid="newsletter-subject-input"
              className="mt-1.5 w-full rounded-xl border border-[#E2DDD5] bg-white px-4 py-2.5 font-normal focus:border-[#3B6B4C] focus:outline-none" />
          </label>
          <label className="block text-sm font-medium text-[#2C332E]">
            Contenu
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={20000} data-testid="newsletter-body-input"
              className="mt-1.5 w-full rounded-xl border border-[#E2DDD5] bg-white px-4 py-3 font-normal leading-relaxed focus:border-[#3B6B4C] focus:outline-none" />
          </label>
          <p className="text-xs text-[#626D66]">
            Ligne vide = nouveau paragraphe · lignes commençant par « - » = liste · les liens https:// deviennent cliquables. Le lien de désinscription personnel et l'identité de La Maison d'Auben sont ajoutés automatiquement.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={preview} disabled={!ready} className={`${btn} border border-[#E2DDD5] bg-white text-[#1E3A2B] hover:bg-[#FAF8F5]`} data-testid="newsletter-preview-btn">
              <Eye className="h-4 w-4" /> Aperçu
            </button>
            <button onClick={sendTest} disabled={!ready || busy || !settings?.owner_email_configured} className={`${btn} border border-[#E2DDD5] bg-white text-[#1E3A2B] hover:bg-[#FAF8F5]`} data-testid="newsletter-send-test-btn">
              <FlaskConical className="h-4 w-4" /> M'envoyer un test
            </button>
            <button onClick={() => setConfirmOpen(true)} disabled={!ready || recipientCount === 0} className={`${btn} bg-[#1E3A2B] text-[#FAF8F5] hover:bg-[#3B6B4C]`} data-testid="newsletter-open-send-btn">
              <Send className="h-4 w-4" /> Envoyer à {recipientCount} destinataire{recipientCount > 1 ? "s" : ""}
            </button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[#2C332E]">Aperçu</p>
          {previewHtml ? (
            <iframe title="Aperçu de la newsletter" srcDoc={previewHtml} sandbox="" data-testid="newsletter-preview-frame"
              className="h-[520px] w-full rounded-xl border border-[#E2DDD5] bg-white" />
          ) : (
            <div className="flex h-[520px] items-center justify-center rounded-xl border border-dashed border-[#E2DDD5] text-sm text-[#626D66]" data-testid="newsletter-preview-empty">
              Cliquez sur « Aperçu » pour voir l'e-mail tel qu'il sera reçu.
            </div>
          )}
        </div>
      </div>
      <ConfirmSendDialog
        open={confirmOpen} onOpenChange={setConfirmOpen} subject={subject} body={body}
        recipientCount={recipientCount} allEligible={allEligible} selectedIds={selectedIds}
        confirmWord={settings?.confirm_word || "ENVOYER"} dryRun={settings?.dry_run}
        onSent={() => { setSubject(""); setBody(""); setPreviewHtml(""); onSent(); }}
      />
    </Card>
  );
}
