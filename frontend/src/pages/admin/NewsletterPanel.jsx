import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminNewsletter, adminNewsletterSettings } from "@/lib/api";
import { SubscriberList } from "@/pages/admin/newsletter/SubscriberList";
import { Composer } from "@/pages/admin/newsletter/Composer";
import { CampaignHistory } from "@/pages/admin/newsletter/CampaignHistory";

export default function NewsletterPanel() {
  const qc = useQueryClient();
  const { data: subs = [] } = useQuery({ queryKey: ["admin-newsletter"], queryFn: adminNewsletter });
  const { data: settings } = useQuery({ queryKey: ["admin-newsletter-settings"], queryFn: adminNewsletterSettings });
  const [selected, setSelected] = useState(new Set());
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-newsletter"] });
    qc.invalidateQueries({ queryKey: ["admin-newsletter-campaigns"] });
  };
  const eligible = subs.filter((s) => s.eligible);
  const recipientCount = eligible.filter((s) => selected.has(s.id)).length;

  return (
    <div className="space-y-6" data-testid="admin-newsletter-panel">
      {settings?.dry_run && (
        <div className="rounded-xl border border-[#D4A359] bg-[#FBF3E4] px-4 py-3 text-sm text-[#6B4E1F]" data-testid="newsletter-dry-run-banner">
          Mode simulation actif : aucun e-mail n'est réellement envoyé depuis cet environnement.
        </div>
      )}
      <SubscriberList
        subs={subs}
        selected={selected}
        setSelected={setSelected}
        onChange={refresh}
      />
      <Composer
        settings={settings}
        recipientCount={recipientCount}
        selectedIds={eligible.filter((s) => selected.has(s.id)).map((s) => s.id)}
        onTested={refresh}
        onSent={() => { setSelected(new Set()); refresh(); }}
      />
      <CampaignHistory />
    </div>
  );
}
