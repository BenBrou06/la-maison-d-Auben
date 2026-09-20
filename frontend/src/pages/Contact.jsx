import React, { useState } from "react";
import { toast } from "sonner";
import { Mail, Send, MessageCircle } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Reveal } from "@/components/Reveal";
import { sendContact } from "@/lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendContact(form);
      setSent(true);
      toast.success("Message envoyé. Merci !");
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const field = "w-full rounded-xl border border-[#E2DDD5] bg-white px-4 py-3 text-[#2C332E] placeholder-[#626D66]/60 focus:outline-none focus:ring-2 focus:ring-[#87A987]";

  return (
    <>
      <Seo title="Contact — La Maison d'Auben" description="Une question ? Écrivez-nous, nous répondons rapidement." path="/contact" />
      <section className="container-app grid gap-10 py-14 sm:py-20 lg:grid-cols-2">
        <Reveal>
          <span className="eyebrow">Contact</span>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#1E3A2B] sm:text-5xl">Parlons-en</h1>
          <p className="mt-5 text-[#626D66]">Une question sur un produit, un souci de téléchargement, une idée ? Nous sommes une vraie petite équipe et nous lisons chaque message.</p>
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-[#2C332E]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF0EC] text-[#3B6B4C]"><Mail className="h-5 w-5" /></span> contact@lamaisondauben.fr <span className="text-xs text-[#87A987]">(à compléter)</span></div>
            <div className="flex items-center gap-3 text-[#2C332E]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF0EC] text-[#3B6B4C]"><MessageCircle className="h-5 w-5" /></span> Réponse sous 48h ouvrées</div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          {sent ? (
            <div className="card-soft p-8 text-center" data-testid="contact-success">
              <Send className="mx-auto h-12 w-12 text-[#3B6B4C]" />
              <h2 className="mt-5 font-serif text-2xl text-[#1E3A2B]">Message envoyé !</h2>
              <p className="mt-3 text-[#626D66]">Merci, nous revenons vers vous très vite.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="card-soft space-y-4 p-6 sm:p-8" data-testid="contact-form">
              <div className="grid gap-4 sm:grid-cols-2">
                <input required placeholder="Votre nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} data-testid="contact-name" />
                <input required type="email" placeholder="Votre e-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} data-testid="contact-email" />
              </div>
              <input placeholder="Sujet" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={field} data-testid="contact-subject" />
              <textarea required rows={5} placeholder="Votre message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={field} data-testid="contact-message" />
              <button type="submit" disabled={loading} data-testid="contact-submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] transition-all hover:bg-[#3B6B4C] disabled:opacity-70">
                {loading ? "Envoi…" : <>Envoyer le message <Send className="h-4 w-4" /></>}
              </button>
            </form>
          )}
        </Reveal>
      </section>
    </>
  );
}
