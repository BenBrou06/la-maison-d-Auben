import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, ShoppingBag, Mail, MessageSquare, Package, Upload, Image as ImageIcon, CheckCircle2, Trash2, Save, FileSpreadsheet, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Seo } from "@/components/Seo";
import ContentPanel from "@/pages/admin/ContentPanel";
import {
  adminMe, adminOrders, adminNewsletter, adminMessages, getProducts,
  adminUploadProductFile, adminDeleteProductFile, adminUpdateProduct, api,
} from "@/lib/api";
import { formatPrice } from "@/lib/i18n";

const TABS = [
  { key: "products", label: "Produits", icon: Package },
  { key: "content", label: "Contenu", icon: FileText },
  { key: "orders", label: "Commandes", icon: ShoppingBag },
  { key: "newsletter", label: "Newsletter", icon: Mail },
  { key: "messages", label: "Messages", icon: MessageSquare },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("products");
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    adminMe().then(() => setAuthed(true)).catch(() => { setAuthed(false); navigate("/admin/login"); });
  }, [navigate]);

  const logout = () => { localStorage.removeItem("auben_admin_token"); navigate("/admin/login"); };

  if (authed === null) return <div className="flex min-h-screen items-center justify-center text-[#626D66]">Chargement…</div>;

  return (
    <>
      <Seo title="Tableau de bord — Admin" description="Administration" path="/admin" />
      <div className="min-h-screen bg-[#F2EDE4]">
        <header className="border-b border-[#E2DDD5] bg-[#FAF8F5]">
          <div className="container-app flex h-[70px] items-center justify-between">
            <Logo />
            <button onClick={logout} data-testid="admin-logout-btn" className="inline-flex items-center gap-2 rounded-xl border border-[#E2DDD5] bg-white px-4 py-2.5 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </div>
        </header>

        <div className="container-app py-8">
          <h1 className="font-serif text-3xl font-bold text-[#1E3A2B]">Tableau de bord</h1>

          <div className="mt-6 flex flex-wrap gap-2" data-testid="admin-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                data-testid={`admin-tab-${t.key}`}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  tab === t.key ? "bg-[#1E3A2B] text-[#FAF8F5]" : "border border-[#E2DDD5] bg-white text-[#2C332E] hover:border-[#87A987]"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            {tab === "products" && <ProductsPanel qc={qc} />}
            {tab === "content" && <ContentPanel />}
            {tab === "orders" && <OrdersPanel />}
            {tab === "newsletter" && <NewsletterPanel />}
            {tab === "messages" && <MessagesPanel />}
          </div>
        </div>
      </div>
    </>
  );
}

function Panel({ title, children }) {
  return (
    <div className="card-soft overflow-hidden p-6">
      <h2 className="font-serif text-xl font-semibold text-[#1E3A2B]">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ProductsPanel({ qc }) {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => getProducts() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  const uploadFile = async (slug, file) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      await adminUploadProductFile(slug, fd);
      toast.success("Fichier téléchargeable mis à jour !");
      refresh();
    } catch { toast.error("Échec de l'upload."); }
  };

  const deleteFile = async (slug) => {
    if (!window.confirm("Supprimer le fichier associé ? Le produit repassera en « Bientôt disponible ».")) return;
    try {
      await adminDeleteProductFile(slug);
      toast.success("Fichier supprimé. Produit indisponible à l'achat.");
      refresh();
    } catch { toast.error("Échec de la suppression."); }
  };

  const uploadImage = async (slug, file, field) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload/image", fd);
      await adminUpdateProduct(slug, { [field]: data.path });
      toast.success("Image mise à jour !");
      refresh();
    } catch { toast.error("Échec de l'upload."); }
  };

  const savePrice = async (slug, raw) => {
    const value = parseFloat(String(raw).replace(",", "."));
    if (isNaN(value) || value <= 0) { toast.error("Prix invalide."); return; }
    try {
      const res = await adminUpdateProduct(slug, { price: value });
      if (res.stripe_synced === false) toast.warning("Prix enregistré, mais la synchro Stripe a échoué. Réessayez.");
      else toast.success("Prix mis à jour !");
      refresh();
    } catch { toast.error("Échec de la mise à jour du prix."); }
  };

  return (
    <Panel title="Produits">
      <p className="mb-4 text-sm text-[#626D66]">
        Gérez chaque produit : prix, fichier Excel et image. Un produit <strong>sans fichier</strong> est automatiquement « Bientôt disponible » et non achetable. Dès qu'un fichier est ajouté, il redevient disponible.
      </p>
      <div className="space-y-4">
        {products.map((p) => (
          <ProductRow key={p.slug} p={p} onUploadFile={uploadFile} onDeleteFile={deleteFile} onUploadImage={uploadImage} onSavePrice={savePrice} />
        ))}
      </div>
    </Panel>
  );
}

function ProductRow({ p, onUploadFile, onDeleteFile, onUploadImage, onSavePrice }) {
  const [price, setPrice] = useState(p.price ?? "");
  useEffect(() => { setPrice(p.price ?? ""); }, [p.price]);
  const available = !!p.purchasable;

  return (
    <div className="rounded-xl border border-[#E2DDD5] bg-white p-5" data-testid={`admin-product-${p.slug}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg text-[#1E3A2B]">{p.name}</p>
          <span
            data-testid={`admin-product-status-${p.slug}`}
            className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${available ? "bg-[#EAF0EC] text-[#3B6B4C]" : "bg-[#F6ECD9] text-[#A9772F]"}`}
          >
            {available ? "Disponible" : "Bientôt disponible"}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${p.download_storage_path ? "text-[#3B6B4C]" : "text-[#A9772F]"}`} data-testid={`admin-product-file-${p.slug}`}>
          {p.download_storage_path
            ? <><CheckCircle2 className="h-4 w-4" /> Fichier {p.download_is_placeholder ? "(placeholder)" : "prêt"}{p.download_filename ? ` · ${p.download_filename}` : ""}</>
            : <><FileSpreadsheet className="h-4 w-4" /> Aucun fichier</>}
        </span>
      </div>

      {/* Prix */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-[#626D66]">Prix (EUR, TTC)</label>
          <input
            type="number" step="0.01" min="0" value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid={`admin-price-input-${p.slug}`}
            className="mt-1 w-32 rounded-lg border border-[#E2DDD5] bg-[#FAF8F5] px-3 py-2 text-sm text-[#1E3A2B] focus:border-[#87A987] focus:outline-none"
            placeholder="7.99"
          />
        </div>
        <button
          onClick={() => onSavePrice(p.slug, price)}
          data-testid={`admin-price-save-${p.slug}`}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2DDD5] px-4 py-2.5 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]"
        >
          <Save className="h-4 w-4" /> Enregistrer le prix
        </button>
      </div>

      {/* Fichier + image */}
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#1E3A2B] px-4 py-2.5 text-sm font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]">
          <Upload className="h-4 w-4" /> {p.download_storage_path ? "Remplacer le fichier" : "Ajouter un fichier"}
          <input type="file" accept=".xlsx,.xls,.zip,.pdf,.csv" className="hidden" data-testid={`upload-file-${p.slug}`} onChange={(e) => e.target.files[0] && onUploadFile(p.slug, e.target.files[0])} />
        </label>
        {p.download_storage_path && (
          <button
            onClick={() => onDeleteFile(p.slug)}
            data-testid={`delete-file-${p.slug}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E7C9C4] px-4 py-2.5 text-sm font-medium text-[#B4453A] hover:bg-[#F7ECEA]"
          >
            <Trash2 className="h-4 w-4" /> Supprimer le fichier
          </button>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#E2DDD5] px-4 py-2.5 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]">
          <ImageIcon className="h-4 w-4" /> Image principale
          <input type="file" accept="image/*" className="hidden" data-testid={`upload-main-image-${p.slug}`} onChange={(e) => e.target.files[0] && onUploadImage(p.slug, e.target.files[0], "main_image")} />
        </label>
      </div>
    </div>
  );
}

function OrdersPanel() {
  const { data: orders = [] } = useQuery({ queryKey: ["admin-orders"], queryFn: adminOrders });
  return (
    <Panel title={`Commandes (${orders.length})`}>
      {orders.length === 0 ? <p className="text-sm text-[#626D66]">Aucune commande pour le moment.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="admin-orders-table">
            <thead><tr className="border-b border-[#E2DDD5] text-left text-[#626D66]">
              <th className="py-2 pr-4">Produit</th><th className="py-2 pr-4">Montant</th><th className="py-2 pr-4">E-mail</th><th className="py-2 pr-4">Statut</th><th className="py-2">Date</th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[#E2DDD5]/60">
                  <td className="py-2.5 pr-4 font-medium text-[#1E3A2B]">{o.product_name}</td>
                  <td className="py-2.5 pr-4">{formatPrice(o.amount, o.currency)}</td>
                  <td className="py-2.5 pr-4 text-[#626D66]">{o.customer_email || "—"}</td>
                  <td className="py-2.5 pr-4"><span className="rounded-full bg-[#EAF0EC] px-2.5 py-1 text-xs font-medium text-[#3B6B4C]">{o.status}</span></td>
                  <td className="py-2.5 text-[#626D66]">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function NewsletterPanel() {
  const { data: subs = [] } = useQuery({ queryKey: ["admin-newsletter"], queryFn: adminNewsletter });
  return (
    <Panel title={`Abonnés newsletter (${subs.length})`}>
      {subs.length === 0 ? <p className="text-sm text-[#626D66]">Aucun abonné pour le moment.</p> : (
        <ul className="space-y-2" data-testid="admin-newsletter-list">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg bg-[#FAF8F5] px-4 py-2.5 text-sm">
              <span className="text-[#2C332E]">{s.email}</span>
              <span className="text-xs text-[#626D66]">{new Date(s.created_at).toLocaleDateString("fr-FR")}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MessagesPanel() {
  const { data: msgs = [] } = useQuery({ queryKey: ["admin-messages"], queryFn: adminMessages });
  return (
    <Panel title={`Messages (${msgs.length})`}>
      {msgs.length === 0 ? <p className="text-sm text-[#626D66]">Aucun message pour le moment.</p> : (
        <div className="space-y-3" data-testid="admin-messages-list">
          {msgs.map((m) => (
            <div key={m.id} className="rounded-xl border border-[#E2DDD5] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-[#1E3A2B]">{m.name} <span className="text-sm font-normal text-[#626D66]">· {m.email}</span></p>
                <span className="text-xs text-[#626D66]">{new Date(m.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
              {m.subject && <p className="mt-1 text-sm font-medium text-[#3B6B4C]">{m.subject}</p>}
              <p className="mt-1 text-sm text-[#2C332E]">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
