import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2, ImagePlus, Film, RefreshCw, Image as ImageIcon } from "lucide-react";
import { adminUploadImage, adminUploadVideo, mediaUrl } from "@/lib/api";
import { inputCls, helpCls, move, IconBtn } from "@/pages/admin/product/ui";

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 80;
const hasMedia = (g) => !!(g.storage_path || g.url);
const isVideo = (g) => g.type === "video";

// Image d'aperçu extraite de la vidéo dans le navigateur (aucun service externe).
const capturePoster = (file) => new Promise((resolve) => {
  const v = document.createElement("video");
  const url = URL.createObjectURL(file);
  const done = (blob) => { URL.revokeObjectURL(url); resolve(blob); };
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
  v.onseeked = () => {
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    if (!c.width) return done(null);
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((b) => done(b), "image/jpeg", 0.9);
  };
  v.onerror = () => done(null);
  setTimeout(() => done(null), 15000);
});

const errMsg = (e, fallback) => e.response?.data?.detail || fallback;

function useUploader() {
  const [progress, setProgress] = useState(null);
  const image = async (file) => {
    if (file.size > MAX_IMAGE_MB * 1048576) { toast.error(`Image trop lourde (${(file.size / 1048576).toFixed(1)} Mo). Maximum : ${MAX_IMAGE_MB} Mo.`); return null; }
    try { return (await adminUploadImage(file)).path; } catch (e) { toast.error(errMsg(e, "Échec de l'envoi de l'image.")); return null; }
  };
  const video = async (file) => {
    if (!/\.(mp4|webm)$/i.test(file.name)) { toast.error("Format non accepté : choisissez une vidéo MP4 ou WebM."); return null; }
    if (file.size > MAX_VIDEO_MB * 1048576) { toast.error(`Vidéo trop lourde (${Math.round(file.size / 1048576)} Mo). Maximum : ${MAX_VIDEO_MB} Mo. Raccourcissez-la ou réduisez sa résolution.`); return null; }
    setProgress(0);
    try {
      const { path } = await adminUploadVideo(file, setProgress);
      const blob = await capturePoster(file);
      const poster = blob ? await image(new File([blob], "apercu-video.jpg", { type: "image/jpeg" })) : null;
      return { path, poster };
    } catch (e) { toast.error(errMsg(e, "Échec de l'envoi de la vidéo.")); return null; } finally { setProgress(null); }
  };
  return { image, video, progress };
}

function Preview({ g }) {
  if (!hasMedia(g)) return <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-[#A9772F]">Emplacement vide : non affiché sur le site</div>;
  const src = g.url || mediaUrl(g.storage_path);
  return isVideo(g)
    ? <video src={src} poster={g.poster_path ? mediaUrl(g.poster_path) : undefined} controls preload="metadata" className="h-full w-full bg-[#1E3A2B] object-contain" />
    : <img src={src} alt="" className="h-full w-full object-contain" />;
}

function MediaCard({ g, i, list, onChange, up }) {
  const update = (patch) => { const n = [...list]; n[i] = { ...n[i], ...patch }; onChange(n); };
  const replace = async (file) => {
    if (!file) return;
    if (isVideo(g)) { const r = await up.video(file); if (r) update({ storage_path: r.path, url: "", poster_path: r.poster || "" }); }
    else { const p = await up.image(file); if (p) update({ storage_path: p, url: "" }); }
  };
  const poster = async (file) => { const p = file && await up.image(file); if (p) update({ poster_path: p }); };
  const pick = "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-2 text-xs font-medium text-[#1E3A2B] hover:bg-[#EAF0EC]";
  return (
    <div className="rounded-lg border border-[#E2DDD5] p-3" data-testid={`content-gallery-${i}`}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-[#E2DDD5] bg-[#F2EDE4]">
        <Preview g={g} />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#1E3A2B]" data-testid={`content-gallery-type-${i}`}>
          {isVideo(g) ? <><Film className="h-3 w-3" /> Vidéo</> : <><ImageIcon className="h-3 w-3" /> Image</>} · n° {i + 1}
        </span>
      </div>
      <input className={`${inputCls} mt-2`} placeholder="Légende affichée sous le média" value={g.caption || ""} data-testid={`content-gallery-caption-${i}`} onChange={(e) => update({ caption: e.target.value })} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className={pick}>
          <RefreshCw className="h-4 w-4" /> {hasMedia(g) ? "Remplacer" : "Ajouter"}
          <input type="file" accept={isVideo(g) ? "video/mp4,video/webm" : "image/*"} className="hidden" data-testid={`content-gallery-upload-${i}`} onChange={(e) => { replace(e.target.files[0]); e.target.value = ""; }} />
        </label>
        {isVideo(g) && hasMedia(g) && (
          <label className={pick} title="Image montrée avant la lecture">
            <ImagePlus className="h-4 w-4" /> Image d'aperçu
            <input type="file" accept="image/*" className="hidden" data-testid={`content-gallery-poster-${i}`} onChange={(e) => { poster(e.target.files[0]); e.target.value = ""; }} />
          </label>
        )}
        <span className="flex-1" />
        <IconBtn onClick={() => onChange(move(list, i, -1))} title="Monter" testid={`content-gallery-up-${i}`}><ArrowUp className="h-4 w-4" /></IconBtn>
        <IconBtn onClick={() => onChange(move(list, i, 1))} title="Descendre" testid={`content-gallery-down-${i}`}><ArrowDown className="h-4 w-4" /></IconBtn>
        <IconBtn danger onClick={() => onChange(list.filter((_, k) => k !== i))} title="Retirer de la fiche" testid={`content-gallery-delete-${i}`}><Trash2 className="h-4 w-4" /></IconBtn>
      </div>
    </div>
  );
}

export function MediaEditor({ list, onChange, disabled }) {
  const up = useUploader();
  const imgRef = useRef(null);
  const vidRef = useRef(null);
  const shown = list.filter(hasMedia);
  const add = async (file, type) => {
    if (!file) return;
    const r = type === "video" ? await up.video(file) : await up.image(file);
    if (!r) return;
    const item = type === "video" ? { type, storage_path: r.path, poster_path: r.poster || "" } : { type, storage_path: r };
    onChange([...list, { key: `m-${Date.now()}`, caption: "", url: "", ...item }]);
    toast.success(`${type === "video" ? "Vidéo" : "Image"} ajoutée. Pensez à enregistrer.`);
  };
  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-[#E2DDD5] px-3 py-2 text-sm font-medium text-[#1E3A2B] hover:bg-[#EAF0EC] disabled:opacity-50";
  return (
    <div>
      <p className="rounded-lg bg-[#EAF0EC] px-3 py-2 text-xs text-[#3B6B4C]" data-testid="media-summary">
        Sur le site : l'image principale puis {shown.length} média{shown.length > 1 ? "s" : ""} ({shown.filter((g) => !isVideo(g)).length} image(s), {shown.filter(isVideo).length} vidéo(s)), dans l'ordre ci-dessous. Les vidéos ne démarrent jamais seules.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {list.map((g, i) => <MediaCard key={g.key || i} g={g} i={i} list={list} onChange={onChange} up={up} />)}
      </div>
      {up.progress !== null && (
        <div className="mt-3" data-testid="video-upload-progress">
          <div className="h-2 overflow-hidden rounded-full bg-[#E2DDD5]"><div className="h-full bg-[#3B6B4C] transition-[width] duration-300" style={{ width: `${Math.round(up.progress * 100)}%` }} /></div>
          <p className={`mt-1 ${helpCls}`}>Envoi de la vidéo… {Math.round(up.progress * 100)} %</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={disabled || up.progress !== null} onClick={() => imgRef.current.click()} data-testid="content-add-gallery"><ImagePlus className="h-4 w-4" /> Ajouter une image</button>
        <button type="button" className={btn} disabled={disabled || up.progress !== null} onClick={() => vidRef.current.click()} data-testid="content-add-video"><Film className="h-4 w-4" /> Ajouter une vidéo</button>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" data-testid="content-add-gallery-input" onChange={(e) => { add(e.target.files[0], "image"); e.target.value = ""; }} />
        <input ref={vidRef} type="file" accept="video/mp4,video/webm" className="hidden" data-testid="content-add-video-input" onChange={(e) => { add(e.target.files[0], "video"); e.target.value = ""; }} />
      </div>
      <p className={`mt-2 ${helpCls}`}>Images : PNG, JPG, WebP jusqu'à {MAX_IMAGE_MB} Mo, affichées sans recadrage ni recompression. Vidéos : MP4 ou WebM jusqu'à {MAX_VIDEO_MB} Mo ; une image d'aperçu est créée automatiquement (modifiable).</p>
    </div>
  );
}
