import React from "react";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { Seo } from "@/components/Seo";

export default function PaymentCancel() {
  return (
    <>
      <Seo title="Paiement annulé — La Maison d'Auben" description="Votre paiement a été annulé." path="/paiement/annule" />
      <div className="container-app flex min-h-[60vh] items-center justify-center py-16">
        <div className="w-full max-w-md text-center" data-testid="payment-cancel">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2EDE4] text-[#3B6B4C]">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-serif text-2xl font-semibold text-[#1E3A2B]">Paiement annulé</h1>
          <p className="mt-3 text-[#626D66]">Pas de souci, aucun montant n'a été débité. Votre panier vous attend.</p>
          <Link to="/boutique" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]">
            Retour à la boutique
          </Link>
        </div>
      </div>
    </>
  );
}
