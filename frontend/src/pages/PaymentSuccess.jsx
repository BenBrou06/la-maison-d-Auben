import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Download, Loader2, XCircle, Mail } from "lucide-react";
import { Seo } from "@/components/Seo";
import { getPaymentStatus, getOrderBySession, API } from "@/lib/api";
import { formatPrice } from "@/lib/i18n";

const MAX_ATTEMPTS = 12;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState("checking"); // checking | paid | expired | error
  const [order, setOrder] = useState(null);
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) { setState("error"); return; }
    let timer;
    const poll = async () => {
      try {
        const status = await getPaymentStatus(sessionId);
        if (status.payment_status === "paid") {
          const o = await getOrderBySession(sessionId);
          setOrder(o);
          setState("paid");
          return;
        }
        if (["failed", "expired"].includes(status.payment_status)) { setState("expired"); return; }
        attempts.current += 1;
        if (attempts.current >= MAX_ATTEMPTS) { setState("error"); return; }
        timer = setTimeout(poll, 2000);
      } catch {
        attempts.current += 1;
        if (attempts.current >= MAX_ATTEMPTS) { setState("error"); return; }
        timer = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <>
      <Seo title="Confirmation de commande — La Maison d'Auben" description="Merci pour votre achat." path="/paiement/succes" noindex />
      <div className="container-app flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-lg text-center">
          {state === "checking" && (
            <div data-testid="payment-checking">
              <Loader2 className="mx-auto h-14 w-14 animate-spin text-[#3B6B4C]" />
              <h1 className="mt-6 font-serif text-2xl font-semibold text-[#1E3A2B]">Confirmation de votre paiement…</h1>
              <p className="mt-3 text-[#626D66]">Un instant, nous validons votre commande en toute sécurité.</p>
            </div>
          )}

          {state === "paid" && order && (
            <div className="card-soft p-8 sm:p-10" data-testid="payment-success">
              <CheckCircle2 className="mx-auto h-16 w-16 text-[#3B6B4C]" />
              <h1 className="mt-6 font-serif text-3xl font-bold text-[#1E3A2B]">Merci pour votre achat 🌿</h1>
              <p className="mt-3 text-[#626D66]">Votre commande est confirmée. Vous pouvez télécharger votre produit dès maintenant.</p>
              <div className="mt-6 rounded-xl bg-[#EAF0EC] p-5 text-left">
                <p className="font-serif text-lg text-[#1E3A2B]">{order.product_name}</p>
                <p className="mt-1 text-sm text-[#3B6B4C]">Montant payé : {formatPrice(order.amount, order.currency)}</p>
              </div>
              <a
                href={`${API}/download/${order.download_token}`}
                data-testid="download-product-btn"
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-8 py-4 text-lg font-medium text-[#FAF8F5] transition-all hover:bg-[#3B6B4C] active:scale-[0.99]"
              >
                <Download className="h-5 w-5" /> Télécharger mon produit
              </a>
              {order.customer_email && (
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#626D66]">
                  <Mail className="h-4 w-4 text-[#3B6B4C]" />
                  {order.email_sent
                    ? `Un e-mail de confirmation a été envoyé à ${order.customer_email}.`
                    : `Votre lien reste accessible sur cette page.`}
                </p>
              )}
              <p className="mt-6 text-xs text-[#87A987]">Conservez le lien reçu par e-mail : il vous permet de retélécharger votre fichier.</p>
            </div>
          )}

          {state === "expired" && (
            <div data-testid="payment-failed">
              <XCircle className="mx-auto h-14 w-14 text-[#B4472E]" />
              <h1 className="mt-6 font-serif text-2xl font-semibold text-[#1E3A2B]">Le paiement n'a pas abouti</h1>
              <p className="mt-3 text-[#626D66]">Aucun montant n'a été débité. Vous pouvez réessayer quand vous le souhaitez.</p>
              <Link to="/boutique" className="mt-6 inline-flex rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]">Retour à la boutique</Link>
            </div>
          )}

          {state === "error" && (
            <div data-testid="payment-error">
              <Loader2 className="mx-auto h-14 w-14 text-[#87A987]" />
              <h1 className="mt-6 font-serif text-2xl font-semibold text-[#1E3A2B]">Confirmation en cours</h1>
              <p className="mt-3 text-[#626D66]">Votre paiement peut prendre quelques instants. Si vous avez été débité·e, vous recevrez votre lien de téléchargement par e-mail. Contactez-nous si besoin.</p>
              <Link to="/contact" className="mt-6 inline-flex rounded-xl border border-[#E2DDD5] bg-white px-6 py-3.5 font-medium text-[#1E3A2B] hover:bg-[#F2EDE4]">Nous contacter</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
