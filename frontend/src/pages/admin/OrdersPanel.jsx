import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, RefreshCw, Copy, Send, Search } from "lucide-react";
import { ConfirmDeleteDialog } from "@/pages/admin/ConfirmDeleteDialog";
import { adminOrders, adminDeleteOrder, adminRenewDownload, adminSendDownloadLink } from "@/lib/api";
import { formatPrice } from "@/lib/i18n";

const STATE_CLS = {
  valid: "bg-[#EAF0EC] text-[#3B6B4C]", expired: "bg-[#FCEFD9] text-[#8A5A12]", exhausted: "bg-[#FCEFD9] text-[#8A5A12]",
  invalid: "bg-[#FCEFD9] text-[#8A5A12]", file_missing: "bg-[#F6E3E0] text-[#8A2A1F]",
};
const btn = "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50";
const fmt = (s) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—");
const errText = (e, fallback) => {
  const d = e.response?.data?.detail;
  return typeof d === "string" ? d : d?.message || fallback;
};

function ModeTag({ o }) {
  if (o.payment_mode === "live") return null;
  return <span className="ml-1 rounded-full bg-[#F2EDE4] px-2 py-0.5 text-[10px] font-medium text-[#626D66]" data-testid={`order-mode-${o.id}`}>{o.payment_mode === "test" ? "TEST" : "Paiement non vérifiable"}</span>;
}

function SendConfirm({ o, onCancel, onSent }) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await adminSendDownloadLink(o.id);
      toast.success(r.simulated ? "E-mail enregistré (simulation, aucun envoi réel)." : `Lien envoyé à ${r.to}.`);
      onSent(true);
    } catch (e) {
      toast.error(errText(e, "L'e-mail n'a pas pu être envoyé."));
      onSent(false);
    }
    setBusy(false);
  };
  return (
    <div className="mt-3 rounded-xl border border-[#E2DDD5] bg-white p-3 text-sm" data-testid={`send-link-confirm-${o.id}`}>
      <p>Envoyer le nouveau lien de <b>{o.product_name}</b> à <b>{o.customer_email}</b> ?</p>
      <div className="mt-2 flex gap-2">
        <button onClick={send} disabled={busy} className={`${btn} bg-[#1E3A2B] text-[#FAF8F5] hover:bg-[#3B6B4C]`} data-testid={`send-link-confirm-btn-${o.id}`}><Send className="h-3.5 w-3.5" />{busy ? "Envoi…" : "Confirmer l'envoi"}</button>
        <button onClick={onCancel} disabled={busy} className={`${btn} border border-[#E2DDD5] hover:bg-[#FAF8F5]`} data-testid={`send-link-cancel-btn-${o.id}`}>Annuler</button>
      </div>
    </div>
  );
}

function ExceptionForm({ o, message, onCancel, onSubmit, busy }) {
  const [word, setWord] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-[#E8C9A0] bg-[#FCEFD9] p-3 text-sm text-[#5C3D0C]" data-testid={`renew-exception-${o.id}`}>
      <p className="font-medium">Paiement non vérifiable automatiquement</p>
      <p className="mt-1">{message}</p>
      <p className="mt-1">Renouvellement exceptionnel : à faire uniquement si vous êtes certain que cette commande a été payée. L'opération est enregistrée avec votre motif ; la commande n'est pas modifiée.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Motif (ex. paiement vu dans le tableau de bord Stripe le …)" className="mt-2 w-full rounded-lg border border-[#E2DDD5] bg-white px-3 py-2 text-sm" data-testid={`renew-exception-reason-${o.id}`} />
      <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Tapez RENOUVELER pour confirmer" className="mt-2 w-full rounded-lg border border-[#E2DDD5] bg-white px-3 py-2 text-sm" data-testid={`renew-exception-word-${o.id}`} />
      <div className="mt-2 flex gap-2">
        <button onClick={() => onSubmit(word, reason)} disabled={busy || word !== "RENOUVELER" || reason.trim().length < 10} className={`${btn} bg-[#8A5A12] text-white`} data-testid={`renew-exception-submit-${o.id}`}>Renouveler quand même</button>
        <button onClick={onCancel} className={`${btn} border border-[#E2DDD5] bg-white`} data-testid={`renew-exception-cancel-${o.id}`}>Annuler</button>
      </div>
    </div>
  );
}

function DownloadCell({ o, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [exception, setException] = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [fresh, setFresh] = useState(false);
  const renew = async (word, reason) => {
    if (!word && o.download_state === "valid" && !window.confirm("Le lien actuel est encore valide. Le renouveler le rendra inutilisable. Continuer ?")) return;
    setBusy(true);
    try {
      await adminRenewDownload(o.id, word ? { exception_confirmation: word, exception_reason: reason } : {});
      toast.success("Nouveau lien généré, valable 30 jours.");
      setException(null);
      setFresh(true);
      onChanged();
    } catch (e) {
      const d = e.response?.data?.detail;
      if (d?.code === "needs_exception") setException(d.message);
      else toast.error(errText(e, "Le lien n'a pas pu être renouvelé."));
    }
    setBusy(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(o.download_url); toast.success("Lien copié."); } catch { toast.error("Copie impossible : sélectionnez le lien manuellement."); }
  };
  const valid = o.download_state === "valid";
  return (
    <div className="min-w-[260px]">
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_CLS[o.download_state]}`} data-testid={`order-download-state-${o.id}`}>{o.download_state_label}</span>
      <p className="mt-1 text-xs text-[#626D66]" data-testid={`order-download-expiry-${o.id}`}>
        Expire le {fmt(o.download_expires_at)} · {o.download_count || 0}/{o.download_limit || 25} téléchargement(s)
        {o.download_renewal_count ? ` · renouvelé ${o.download_renewal_count} fois` : ""}
      </p>
      {o.renew_blocker ? (
        <p className="mt-1 text-xs text-[#626D66]" data-testid={`order-renew-blocked-${o.id}`}>{o.renew_blocker}</p>
      ) : (
        <>
          {(valid && (fresh || o.download_renewal_count > 0)) && (
            <div className="mt-2 rounded-xl bg-[#FAF8F5] p-2" data-testid={`order-new-link-${o.id}`}>
              <input readOnly value={o.download_url || ""} onFocus={(e) => e.target.select()} className="w-full rounded-lg border border-[#E2DDD5] bg-white px-2 py-1.5 text-xs" data-testid={`order-link-input-${o.id}`} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={copy} className={`${btn} border border-[#E2DDD5] bg-white hover:bg-[#FAF8F5]`} data-testid={`order-copy-link-${o.id}`}><Copy className="h-3.5 w-3.5" />Copier le lien</button>
                {o.customer_email && <button onClick={() => setConfirmSend(true)} className={`${btn} border border-[#E2DDD5] bg-white hover:bg-[#FAF8F5]`} data-testid={`order-send-link-${o.id}`}><Send className="h-3.5 w-3.5" />{o.link_email_status === "failed" ? "Réessayer l'envoi" : "Envoyer le lien par e-mail"}</button>}
              </div>
              {o.link_email_status && <p className={`mt-1 text-xs ${o.link_email_status === "failed" ? "text-[#8A2A1F]" : "text-[#3B6B4C]"}`} data-testid={`order-link-email-status-${o.id}`}>{o.link_email_status === "sent" ? `E-mail envoyé le ${fmt(o.link_email_at)}` : o.link_email_status === "failed" ? `Échec de l'envoi le ${fmt(o.link_email_at)} — le lien reste valable` : "Envoi en cours…"}</p>}
              {confirmSend && <SendConfirm o={o} onCancel={() => setConfirmSend(false)} onSent={() => { setConfirmSend(false); onChanged(); }} />}
            </div>
          )}
          {o.download_state !== "file_missing" && (
            <button onClick={() => renew()} disabled={busy} className={`${btn} mt-2 bg-[#1E3A2B] text-[#FAF8F5] hover:bg-[#3B6B4C]`} data-testid={`order-renew-btn-${o.id}`}>
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />{busy ? "Vérification du paiement…" : "Renouveler le lien de téléchargement"}
            </button>
          )}
          {o.download_state === "file_missing" && <p className="mt-1 text-xs text-[#8A2A1F]" data-testid={`order-file-missing-${o.id}`}>Ajoutez le fichier du produit dans « Produits » pour pouvoir renouveler.</p>}
          {exception && <ExceptionForm o={o} message={exception} busy={busy} onCancel={() => setException(null)} onSubmit={renew} />}
        </>
      )}
    </div>
  );
}

export default function OrdersPanel() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({ queryKey: ["admin-orders"], queryFn: adminOrders });
  const [toDelete, setToDelete] = useState(null);
  const [q, setQ] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-orders"] });
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? orders.filter((o) => (o.customer_email || "").toLowerCase().includes(s) || (o.id || "").toLowerCase().includes(s)) : orders;
  }, [orders, q]);
  const del = async (word) => {
    try {
      const r = await adminDeleteOrder(toDelete.id, word);
      toast.success(`Commande TEST supprimée (${r.deleted_transactions} transaction(s) TEST).`);
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || "Suppression impossible."); }
    setToDelete(null);
  };
  return (
    <div className="card-soft overflow-hidden p-6">
      <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">Commandes ({orders.length})</h2>
      <div className="mt-4">
        <label className="relative block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#626D66]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par e-mail ou numéro de commande" className="w-full rounded-xl border border-[#E2DDD5] bg-white py-2.5 pl-9 pr-3 text-sm" data-testid="orders-search-input" />
        </label>
        {orders.length === 0 ? <p className="mt-4 text-sm text-[#626D66]">Aucune commande pour le moment.</p> : shown.length === 0 ? <p className="mt-4 text-sm text-[#626D66]" data-testid="orders-search-empty">Aucune commande ne correspond à cette recherche.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm" data-testid="admin-orders-table">
              <thead><tr className="border-b border-[#E2DDD5] text-left text-[#626D66]">
                <th className="py-2 pr-4">Produit</th><th className="py-2 pr-4">Montant</th><th className="py-2 pr-4">E-mail</th><th className="py-2 pr-4">Statut</th><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Téléchargement</th><th className="py-2">Suppression</th>
              </tr></thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} className="border-b border-[#E2DDD5]/60 align-top" data-testid={`admin-order-row-${o.id}`}>
                    <td className="py-2.5 pr-4 font-medium text-[#1E3A2B]">{o.product_name}<ModeTag o={o} /><span className="block text-[10px] font-normal text-[#626D66]">N° {o.id}</span></td>
                    <td className="py-2.5 pr-4">{formatPrice(o.amount, o.currency)}</td>
                    <td className="py-2.5 pr-4 text-[#626D66]">{o.customer_email || "—"}</td>
                    <td className="py-2.5 pr-4"><span className="rounded-full bg-[#EAF0EC] px-2.5 py-1 text-xs font-medium text-[#3B6B4C]">{o.status}</span></td>
                    <td className="py-2.5 pr-4 text-[#626D66]">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="py-2.5 pr-4"><DownloadCell o={o} onChanged={refresh} /></td>
                    <td className="py-2.5 text-xs">
                      {o.deletable ? (
                        <button onClick={() => setToDelete(o)} className="inline-flex items-center gap-1 text-[#8A2A1F] hover:underline" data-testid={`order-delete-btn-${o.id}`}>
                          <Trash2 className="h-3.5 w-3.5" /> Supprimer (TEST)
                        </button>
                      ) : (
                        <span className="text-[#626D66]" title={(o.deletion_blockers || []).join(" ")} data-testid={`order-delete-blocked-${o.id}`}>
                          Protégée — {(o.deletion_blockers || [])[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDeleteDialog
        open={!!toDelete} testid="delete-order"
        title="Supprimer cette commande TEST ?"
        description={`Commande ${toDelete?.product_name || ""} — ${toDelete?.customer_email || ""}. Le serveur revérifie qu'elle et ses transactions sont en mode Stripe TEST ; aucune action Stripe ni e-mail n'est déclenché.`}
        onCancel={() => setToDelete(null)} onConfirm={del}
      />
    </div>
  );
}
