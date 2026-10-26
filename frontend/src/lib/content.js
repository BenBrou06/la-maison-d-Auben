import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getContent } from "@/lib/api";
import { defaultsFor } from "@/content/schema";

// Contenu d'une page = valeurs par défaut du code + champs modifiés depuis l'admin.
export function useContent(key) {
  const { data = {} } = useQuery({ queryKey: ["site-content"], queryFn: getContent, staleTime: 60_000 });
  return { ...defaultsFor(key), ...(data[key] || {}) };
}

const LINK = /\[([^\]]+)\]\(((?:https:\/\/|mailto:|\/)[^\s)]+)\)/g;

// Texte brut + liens [texte](lien) ; aucun HTML n'est interprété.
export function InlineText({ text }) {
  const out = [];
  let last = 0;
  for (const m of (text || "").matchAll(LINK)) {
    out.push(text.slice(last, m.index));
    const [, label, href] = m;
    out.push(href.startsWith("/")
      ? <Link key={m.index} to={href} className="underline">{label}</Link>
      : <a key={m.index} href={href} className="underline" {...(href.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{label}</a>);
    last = m.index + m[0].length;
  }
  out.push((text || "").slice(last));
  return <>{out}</>;
}

export const toBlocks = (body) =>
  (body || "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.split("\n").filter((l) => l.trim())).filter((l) => l.length)
    .map((lines) => (lines.every((l) => l.trimStart().startsWith("- "))
      ? { type: "ul", items: lines.map((l) => l.trimStart().slice(2)) }
      : { type: "p", text: lines.join("\n") }));

// Rend un texte en paragraphes (ligne vide) et listes (lignes « - »), avec les classes fournies.
export function RichText({ body, pClass, ulClass, liClass }) {
  return toBlocks(body).map((b, i) => (b.type === "ul" ? (
    <ul key={i} className={ulClass}>{b.items.map((it, k) => <li key={k} className={liClass}><InlineText text={it} /></li>)}</ul>
  ) : (
    <p key={i} className={pClass}>{b.text.split("\n").map((ln, k) => <React.Fragment key={k}>{k > 0 && <br />}<InlineText text={ln} /></React.Fragment>)}</p>
  )));
}
