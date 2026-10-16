import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { unsubscribeNewsletter } from "@/lib/api";

export default function NewsletterUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  const confirm = async () => {
    setState("loading");
    try {
      const res = await unsubscribeNewsletter(token);
      setMessage(res.message);
      setState("done");
    } catch (e) {
      setMessage(e.response?.data?.detail || "Une erreur est survenue. Réessayez.");
      setState("error");
    }
  };

  return (
    <>
      <Seo title="Désinscription de la newsletter — La Maison d'Auben" description="Se désinscrire de la newsletter." path="/newsletter/desinscription" noindex />
      <div className="container-app mx-auto max-w-xl py-20 text-center" data-testid="newsletter-unsubscribe-page">
        <h1 className="font-serif text-4xl font-bold text-[#1E3A2B]">Désinscription</h1>
        {!token ? (
          <p className="mt-6 text-[#626D66]" data-testid="unsubscribe-missing-token">
            Lien incomplet. Utilisez le lien reçu par e-mail ou écrivez-nous à lamaisondauben@gmail.com.
          </p>
        ) : state === "done" ? (
          <p className="mt-6 text-[#1E3A2B]" role="status" data-testid="unsubscribe-success">{message}</p>
        ) : (
          <>
            <p className="mt-6 text-[#626D66]">Confirmez-vous ne plus vouloir recevoir la newsletter de La Maison d'Auben ?</p>
            <button
              onClick={confirm}
              disabled={state === "loading"}
              data-testid="unsubscribe-confirm-btn"
              className="mt-8 rounded-xl bg-[#1E3A2B] px-8 py-3.5 font-medium text-[#FAF8F5] transition-colors hover:bg-[#3B6B4C] disabled:opacity-60"
            >
              {state === "loading" ? "…" : "Confirmer la désinscription"}
            </button>
            {state === "error" && <p className="mt-4 text-sm text-red-700" role="alert" data-testid="unsubscribe-error">{message}</p>}
          </>
        )}
        <p className="mt-10"><Link to="/" className="text-sm text-[#3B6B4C] underline" data-testid="unsubscribe-home-link">Retour à l'accueil</Link></p>
      </div>
    </>
  );
}
