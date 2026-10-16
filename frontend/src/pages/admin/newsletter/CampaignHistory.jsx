import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminNewsletterCampaigns } from "@/lib/api";
import { Card, Pill, fmtDate } from "@/pages/admin/newsletter/ui";

const STATUS = {
  sending: ["amber", "En cours"], done: ["green", "Terminé"], error: ["red", "Erreur"], interrupted: ["red", "Interrompu"],
};
const RESULT = { sent: "Envoyé", simulated: "Simulé", failed: "Échec", skipped: "Ignoré" };

function CampaignItem({ c }) {
  const [open, setOpen] = useState(false);
  const [tone, label] = STATUS[c.status] || ["grey", c.status];
  const counts = Object.entries(c.counts || {}).filter(([, n]) => n > 0).map(([k, n]) => `${RESULT[k] || k} : ${n}`).join(" · ");
  return (
    <li className="rounded-lg bg-[#FAF8F5] px-4 py-3 text-sm" data-testid={`campaign-item-${c.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 font-medium text-[#1E3A2B]">{c.kind === "test" ? "[TEST] " : ""}{c.subject}</span>
        {c.mode === "dry_run" && <Pill tone="amber">Simulation</Pill>}
        <Pill tone={tone} testid={`campaign-status-${c.id}`}>{label}</Pill>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-[#626D66]">
        <span>{fmtDate(c.created_at)}</span>
        <span data-testid={`campaign-counts-${c.id}`}>{counts || "—"}</span>
        <button onClick={() => setOpen(!open)} className="underline hover:text-[#1E3A2B]" data-testid={`campaign-toggle-${c.id}`}>
          {open ? "Masquer le détail" : "Voir le détail"}
        </button>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 border-t border-[#E2DDD5] pt-2 text-xs">
          {(c.results || []).map((r, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2">
              <span className="break-all">{r.email}</span>
              <span className="text-[#626D66]">{RESULT[r.status] || r.status}{r.reason ? ` — ${r.reason}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CampaignHistory() {
  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-newsletter-campaigns"], queryFn: adminNewsletterCampaigns,
    refetchInterval: (q) => ((q.state.data || []).some((c) => c.status === "sending") ? 2000 : false),
  });
  return (
    <Card title="Historique des envois" testid="newsletter-history-card">
      {campaigns.length === 0 ? <p className="text-sm text-[#626D66]" data-testid="newsletter-history-empty">Aucun envoi pour le moment.</p> : (
        <ul className="space-y-2" data-testid="newsletter-history-list">
          {campaigns.map((c) => <CampaignItem key={c.id} c={c} />)}
        </ul>
      )}
    </Card>
  );
}
