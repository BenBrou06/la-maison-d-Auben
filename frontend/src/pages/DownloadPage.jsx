import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Download, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Seo } from "@/components/Seo";
import { getDownloadInfo, API } from "@/lib/api";

export default function DownloadPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    getDownloadInfo(token)
      .then((d) => { setInfo(d); setState("ok"); })
      .catch(() => setState("invalid"));
  }, [token]);

  return (
    <>
      <Seo title="Téléchargement — La Maison d'Auben" description="Votre lien de téléchargement sécurisé." path={`/telechargement/${token}`} noindex />
      <div className="container-app flex min-h-[60vh] items-center justify-center py-16">
        <div className="w-full max-w-lg text-center">
          {state === "loading" && <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#3B6B4C]" />}

          {state === "invalid" && (
            <div data-testid="download-invalid">
              <AlertTriangle className="mx-auto h-14 w-14 text-[#B4472E]" />
              <h1 className="mt-6 font-serif text-2xl font-semibold text-[#1E3A2B]">Lien invalide</h1>
              <p className="mt-3 text-[#626D66]">Ce lien de téléchargement n'est pas valide. Vérifiez l'e-mail reçu ou contactez-nous.</p>
              <Link to="/contact" className="mt-6 inline-flex rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] hover:bg-[#3B6B4C]">Nous contacter</Link>
            </div>
          )}

          {state === "ok" && info && (
            <div className="card-soft p-8 sm:p-10" data-testid="download-page">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF0EC] text-[#3B6B4C]">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h1 className="mt-6 font-serif text-2xl font-semibold text-[#1E3A2B]">{info.product_name}</h1>
              {info.expired ? (
                <p className="mt-4 text-[#B4472E]">Ce lien de téléchargement a expiré. Contactez-nous pour le renouveler gratuitement.</p>
              ) : !info.file_available ? (
                <p className="mt-4 text-[#626D66]">Le fichier n'est pas encore disponible. Nous vous contacterons dès qu'il sera prêt.</p>
              ) : (
                <>
                  <p className="mt-3 text-[#626D66]">Votre lien est sécurisé et personnel. Cliquez pour télécharger votre produit.</p>
                  <a
                    href={`${API}/download/${token}`}
                    data-testid="download-file-btn"
                    className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A2B] px-8 py-4 text-lg font-medium text-[#FAF8F5] transition-all hover:bg-[#3B6B4C]"
                  >
                    <Download className="h-5 w-5" /> Télécharger
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
