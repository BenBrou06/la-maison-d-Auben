import React, { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Reply, CheckCircle2, Send, RotateCcw, History as HistoryIcon, RefreshCw } from "lucide-react";
import { ConfirmDeleteDialog } from "@/pages/admin/ConfirmDeleteDialog";
import {
  adminMessages, adminDeleteMessage, adminMessagesEmailMode, adminReplyMessage, adminSetMessageStatus,
  adminRetryReply, adminRetryNotification,
} from "@/lib/api";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "");
const STATUS = {
  new: { label: "Nouveau", cls: "bg-[#FCEFD9] text-[#8A5A12]" },
  answered: { label: "Réponse envoyée", cls: "bg-[#EAF0EC] text-[#1E3A2B]" },
  handled: { label: "Traité", cls: "bg-[#EEEAE3] text-[#626D66]" },
};
const SEND = {
  pending: { label: "En attente", cls: "text-[#8A5A12]" },
  sending: { label: "En cours", cls: "text-[#8A5A12]" },
  sent: { label: "Envoyée", cls: "text-[#3B6B4C]" },
  failed: { label: "Échec", cls: "text-[#8A2A1F]" },
  uncertain: { label: "Incertain", cls: "text-[#8A5A12]" },
};
const KIND = {
  temporary: "erreur temporaire du fournisseur",
  refused: "refusé par le fournisseur",
  refused_local: "refusé par le filtre de sécurité du site",
};
const UNCERTAIN_WARNING = "Cet envoi a été interrompu sans confirmation du fournisseur : il a peut-être déjà été reçu.\n\nRenvoyer quand même ? Le destinataire risque de recevoir l'e-mail en double.";
const errText = (j) => [j.error_kind && KIND[j.error_kind], j.error].filter(Boolean).join(" — ");
const canRetry = (j) => j && (j.status === "uncertain" || (j.status === "failed" && j.error_kind === "temporary"));
const newId = () => crypto.randomUUID();

export default function MessagesPanel() {
  const qc = useQueryClient();
  const { data: msgs = [] } = useQuery({ queryKey: ["admin-messages"], queryFn: adminMessages });
  const { data: mode } = useQuery({ queryKey: ["admin-messages-mode"], queryFn: adminMessagesEmailMode });
  const [toDelete, setToDelete] = useState(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-messages"] });
  const del = async (word) => {
    try {
      await adminDeleteMessage(toDelete.id, word);
      toast.success("Message supprimé définitivement.");
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || "Suppression impossible."); }
    setToDelete(null);
  };
  const fresh = msgs.filter((m) => (m.status || "new") === "new").length;
  return (
    <div className="card-soft overflow-hidden p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">Messages ({msgs.length}) {fresh > 0 && <span className="ml-2 rounded-full bg-[#FCEFD9] px-2.5 py-0.5 align-middle text-xs font-medium text-[#8A5A12]" data-testid="messages-new-count">{fresh} nouveau{fresh > 1 ? "x" : ""}</span>}</h2>
        <button onClick={refresh} className="inline-flex items-center gap-1.5 text-sm text-[#3B6B4C] hover:underline" data-testid="messages-refresh-btn"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
      {mode?.dry_run && <p className="mt-3 rounded-xl bg-[#FCEFD9] px-4 py-2.5 text-sm text-[#8A5A12]" data-testid="messages-dry-run-banner">Mode simulation (Preview) : aucun e-mail n'est réellement envoyé.</p>}
      <div className="mt-4">
        {msgs.length === 0 ? <p className="text-sm text-[#626D66]">Aucun message pour le moment.</p> : (
          <div className="space-y-3" data-testid="admin-messages-list">
            {msgs.map((m) => <MessageCard key={m.id} m={m} onDelete={() => setToDelete(m)} refresh={refresh} />)}
          </div>
        )}
      </div>
      <ConfirmDeleteDialog
        open={!!toDelete} testid="delete-message"
        title="Supprimer ce message ?"
        description={`Message de ${toDelete?.name || ""} (${toDelete?.email || ""}). Les autres messages ne sont pas touchés.`}
        onCancel={() => setToDelete(null)} onConfirm={del}
      />
    </div>
  );
}

function MessageCard({ m, onDelete, refresh }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[m.status || "new"] || STATUS.new;
  const isNew = (m.status || "new") === "new";
  const setStatus = async (s) => {
    try { await adminSetMessageStatus(m.id, s); refresh(); } catch (e) { toast.error(e.response?.data?.detail || "Mise à jour impossible."); }
  };
  return (
    <div className={`rounded-xl border bg-white p-4 ${isNew ? "border-l-4 border-[#E2DDD5] border-l-[#C8902E]" : "border-[#E2DDD5]"}`} data-testid={`admin-message-${m.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[#1E3A2B] [overflow-wrap:anywhere]">{m.name} <span className="text-sm font-normal text-[#626D66]">· {m.email}</span></p>
        <span className="flex flex-wrap items-center gap-3 text-xs text-[#626D66]">
          <span className={`rounded-full px-2.5 py-0.5 font-medium ${status.cls}`} data-testid={`message-status-${m.id}`}>{status.label}</span>
          <span data-testid={`message-date-${m.id}`}>{fmt(m.created_at)}</span>
          <button onClick={onDelete} className="inline-flex items-center gap-1 text-[#8A2A1F] hover:underline" data-testid={`message-delete-btn-${m.id}`}>
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </span>
      </div>
      {m.subject && <p className="mt-1 text-sm font-medium text-[#3B6B4C]">{m.subject}</p>}
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#2C332E] [overflow-wrap:anywhere]" data-testid={`message-body-${m.id}`}>{m.message}</p>
      <Notifications m={m} refresh={refresh} />
      <LegacyConsent m={m} />
      <History m={m} refresh={refresh} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-1.5 text-sm text-[#1E3A2B] hover:border-[#87A987]" data-testid={`message-reply-btn-${m.id}`}>
          <Reply className="h-4 w-4" /> Répondre
        </button>
        {m.status !== "handled" ? (
          <button onClick={() => setStatus("handled")} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-1.5 text-sm text-[#1E3A2B] hover:border-[#87A987]" data-testid={`message-mark-handled-${m.id}`}>
            <CheckCircle2 className="h-4 w-4" /> Marquer comme traité
          </button>
        ) : (
          <button onClick={() => setStatus("new")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#626D66] hover:underline" data-testid={`message-mark-new-${m.id}`}>
            <RotateCcw className="h-4 w-4" /> Remettre en nouveau
          </button>
        )}
      </div>
      {open && <ReplyBox m={m} onDone={() => { setOpen(false); refresh(); }} refresh={refresh} />}
    </div>
  );
}

function RetryButton({ job, testid, run }) {
  const [busy, setBusy] = useState(false);
  if (!canRetry(job)) return null;
  const click = async () => {
    const risky = job.status === "uncertain";
    if (risky && !window.confirm(UNCERTAIN_WARNING)) return;
    setBusy(true);
    try { await run(risky); } finally { setBusy(false); }
  };
  return (
    <button onClick={click} disabled={busy} className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-[#1E3A2B] underline disabled:opacity-50" data-testid={testid}>
      <RotateCcw className="h-3 w-3" /> {busy ? "Envoi…" : "Réessayer"}
    </button>
  );
}

function Notifications({ m, refresh }) {
  const jobs = [["owner_notification", "Notification administrateur"], ["confirmation", "Confirmation au client"]].filter(([k]) => m[k]);
  if (!jobs.length) return null;
  const retry = (kind) => async (risky) => {
    try {
      const r = await adminRetryNotification(m.id, kind, { request_id: newId(), confirm_duplicate_risk: risky });
      r.job?.status === "sent" ? toast.success("E-mail envoyé.") : toast.error(`Nouvel échec : ${errText(r.job || {})}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Relance impossible."); }
    refresh();
  };
  return (
    <div className="mt-2 space-y-0.5 text-xs" data-testid={`message-notifications-${m.id}`}>
      {jobs.map(([k, label]) => {
        const j = m[k];
        const s = SEND[j.status] || SEND.pending;
        return (
          <p key={k} className="text-[#626D66]" data-testid={`message-${k}-${m.id}`}>
            {label} : <span className={`font-medium ${s.cls}`} data-testid={`message-${k}-status-${m.id}`}>{s.label}{j.simulated ? " (simulation)" : ""}</span>
            {j.status === "sent" && j.sent_at && <> · {fmt(j.sent_at)}</>}
            {j.content_omitted && <> · contenu non inclus (filtre de sécurité)</>}
            {j.status === "pending" && j.error && <> · nouvel essai automatique prévu</>}
            {["failed", "uncertain"].includes(j.status) && <span className="text-[#8A2A1F]"> · {j.status === "uncertain" ? "interrompu sans confirmation du fournisseur" : errText(j)}</span>}
            <RetryButton job={j} testid={`message-${k}-retry-${m.id}`} run={retry(k)} />
          </p>
        );
      })}
    </div>
  );
}

function LegacyConsent({ m }) {
  if (m.followup_consent === undefined) return null;
  return (
    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#626D66]" data-testid={`message-legacy-consent-${m.id}`}>
      <HistoryIcon className="h-3.5 w-3.5" /> Ancien formulaire : case de suivi {m.followup_consent ? `cochée le ${fmt(m.followup_consent_at)}` : "non cochée"} (historique conservé)
    </p>
  );
}

function History({ m, refresh }) {
  const replies = m.replies || [];
  if (!replies.length) return null;
  const retry = (r) => async (risky) => {
    try {
      await adminRetryReply(m.id, r.id, { request_id: newId(), confirm_duplicate_risk: risky });
      toast.success("Réponse renvoyée.");
    } catch (e) { toast.error(e.response?.data?.detail || "Renvoi impossible."); }
    refresh();
  };
  return (
    <div className="mt-3 space-y-2 border-l-2 border-[#EAF0EC] pl-3" data-testid={`message-history-${m.id}`}>
      {replies.map((r) => {
        const s = SEND[r.status] || SEND.pending;
        return (
          <div key={r.id} className="text-sm" data-testid={`message-reply-${r.id}`}>
            <p className="text-xs text-[#626D66]">
              {fmt(r.sent_at || r.started_at || r.created_at)} · <span className={`font-medium ${s.cls}`} data-testid={`message-reply-status-${r.id}`}>{s.label}{r.simulated ? " (simulation)" : ""}</span>
              {r.email_id && <span className="ml-1">· réf. {r.email_id}</span>}
              {r.retry_of && <span className="ml-1">· nouvel essai</span>}
              {r.retried_by && <span className="ml-1">· renvoyée ensuite</span>}
              {!r.retried_by && <RetryButton job={r} testid={`message-reply-retry-${r.id}`} run={retry(r)} />}
            </p>
            <p className="font-medium text-[#1E3A2B]">{r.subject}</p>
            <p className="whitespace-pre-wrap text-[#2C332E] [overflow-wrap:anywhere]">{r.body}</p>
            {r.status === "failed" && <p className="text-xs text-[#8A2A1F]" data-testid={`message-reply-error-${r.id}`}>{errText(r)}</p>}
            {r.status === "uncertain" && <p className="text-xs text-[#8A5A12]">Envoi interrompu sans confirmation du fournisseur : il a peut-être été reçu.</p>}
          </div>
        );
      })}
    </div>
  );
}

function ReplyBox({ m, onDone, refresh }) {
  const [subject, setSubject] = useState(m.subject ? `Re: ${m.subject}` : "Re: votre message");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const reqId = useRef(newId());
  const busy = useRef(false);
  const send = async () => {
    if (busy.current || !body.trim()) return;
    busy.current = true;
    setSending(true);
    try {
      const r = await adminReplyMessage(m.id, { request_id: reqId.current, subject, body });
      toast.success(r.simulated ? "Réponse enregistrée (simulation, aucun e-mail réel)." : "Réponse envoyée au client.");
      onDone();
    } catch (e) {
      if (e.response?.status === 409) toast.error(e.response.data.detail);
      else { toast.error(e.response?.data?.detail || "La réponse n'a pas pu être envoyée."); reqId.current = newId(); }
      refresh();
    } finally { busy.current = false; setSending(false); }
  };
  const field = "w-full rounded-lg border border-[#E2DDD5] bg-white px-3 py-2 text-sm text-[#2C332E] focus:outline-none focus:ring-2 focus:ring-[#87A987]";
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#FAF8F5] p-4" data-testid={`reply-box-${m.id}`}>
      <p className="text-sm text-[#626D66]">Destinataire : <span className="font-medium text-[#1E3A2B] [overflow-wrap:anywhere]" data-testid={`reply-to-${m.id}`}>{m.email}</span></p>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} aria-label="Objet" className={field} data-testid={`reply-subject-${m.id}`} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={10000} placeholder="Votre réponse…" aria-label="Réponse" className={field} data-testid={`reply-body-${m.id}`} />
      <button onClick={send} disabled={sending || !body.trim() || !subject.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A2B] px-4 py-2 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:opacity-50" data-testid={`reply-send-${m.id}`}>
        <Send className="h-4 w-4" /> {sending ? "Envoi…" : "Envoyer la réponse"}
      </button>
    </div>
  );
}
