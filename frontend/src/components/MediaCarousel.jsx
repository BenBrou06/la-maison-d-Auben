import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand, Play, X } from "lucide-react";
import { mediaUrl } from "@/lib/api";

const srcOf = (m) => (m.url ? m.url : m.storage_path ? mediaUrl(m.storage_path) : "");
export const isVideo = (m) => m.type === "video";
// Uniquement les médias réellement présents (les emplacements vides ne sont jamais montrés au public).
export const playableMedia = (list) => (list || []).filter((m) => srcOf(m));

const Arrow = ({ dir, onClick, testid, light }) => {
  const Ico = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button type="button" onClick={onClick} aria-label={dir === "prev" ? "Média précédent" : "Média suivant"} data-testid={testid}
      className={`absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-md transition-[background-color,transform] duration-200 hover:scale-105 ${dir === "prev" ? "left-3" : "right-3"} ${light ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-[#E2DDD5] bg-white/85 text-[#1E3A2B] shadow-sm hover:bg-white"}`}>
      <Ico className="h-5 w-5" />
    </button>
  );
};

function Slide({ m, i, active, onOpen }) {
  const ref = useRef(null);
  useEffect(() => { if (!active && ref.current) ref.current.pause(); }, [active]);
  if (isVideo(m)) {
    return (
      <video ref={ref} controls playsInline preload="none" poster={m.poster_path ? mediaUrl(m.poster_path) : undefined}
        className="h-full w-full rounded-lg bg-[#1E3A2B]/5 object-contain" data-testid={`carousel-video-${i}`}>
        <source src={srcOf(m)} type={srcOf(m).endsWith(".webm") ? "video/webm" : "video/mp4"} />
      </video>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(i)} className="group relative h-full w-full cursor-zoom-in" aria-label="Agrandir l'image" data-testid={`carousel-image-btn-${i}`}>
      <img src={srcOf(m)} alt={m.caption || "Aperçu du produit"} loading={i === 0 ? "eager" : "lazy"} decoding="async"
        className="h-full w-full object-contain" data-testid={`carousel-image-${i}`} />
      <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#1E3A2B] opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
        <Expand className="h-4 w-4" />
      </span>
    </button>
  );
}

function Thumbs({ media, selected, onPick }) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1" data-testid="carousel-thumbs">
      {media.map((m, i) => (
        <button key={m.key || i} type="button" onClick={() => onPick(i)} aria-label={`Afficher le média ${i + 1}`} aria-current={i === selected}
          data-testid={`carousel-thumb-${i}`}
          className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-[border-color,opacity] duration-200 ${i === selected ? "border-[#3B6B4C]" : "border-transparent opacity-60 hover:opacity-100"}`}>
          {isVideo(m)
            ? (m.poster_path ? <img src={mediaUrl(m.poster_path)} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-[#1E3A2B]" />)
            : <img src={srcOf(m)} alt="" loading="lazy" className="h-full w-full object-cover" />}
          {isVideo(m) && <span className="absolute inset-0 flex items-center justify-center"><Play className="h-5 w-5 fill-white text-white drop-shadow" /></span>}
        </button>
      ))}
    </div>
  );
}

function Lightbox({ media, index, onClose, onMove }) {
  const m = media[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onMove(-1);
      if (e.key === "ArrowRight") onMove(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onMove]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#14271C]/90 p-4 backdrop-blur-md" onClick={onClose} role="dialog" aria-modal="true" aria-label={m.caption || "Aperçu agrandi"} data-testid="lightbox">
      <button autoFocus type="button" className="absolute right-5 top-5 text-white/80 hover:text-white" onClick={onClose} aria-label="Fermer" data-testid="lightbox-close-btn"><X className="h-8 w-8" /></button>
      {media.length > 1 && <Arrow dir="prev" light testid="lightbox-prev-btn" onClick={(e) => { e.stopPropagation(); onMove(-1); }} />}
      <figure className="flex max-h-full max-w-[min(96vw,1600px)] flex-col items-center" onClick={(e) => e.stopPropagation()} data-testid="lightbox-content">
        <img src={srcOf(m)} alt={m.caption || "Capture du produit"} className="max-h-[84vh] w-auto max-w-full rounded-lg bg-white object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]" data-testid="lightbox-image" />
        {m.caption && <figcaption className="mt-4 text-center font-serif text-lg text-white">{m.caption}</figcaption>}
      </figure>
      {media.length > 1 && <Arrow dir="next" light testid="lightbox-next-btn" onClick={(e) => { e.stopPropagation(); onMove(1); }} />}
    </div>
  );
}

export const MediaCarousel = ({ media }) => {
  const [emblaRef, embla] = useEmblaCarousel({ loop: media.length > 1, align: "center" });
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(null);
  useEffect(() => {
    if (!embla) return undefined;
    const on = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", on);
    embla.on("reInit", on);
    return () => { embla.off("select", on); embla.off("reInit", on); };
  }, [embla]);
  const images = media.filter((m) => !isVideo(m));
  const open = (i) => setZoom(images.indexOf(media[i]));
  const moveZoom = useCallback((d) => setZoom((z) => (z + d + images.length) % images.length), [images.length]);
  const close = useCallback(() => setZoom(null), []);
  const current = media[selected] || media[0];

  return (
    <div data-testid="media-carousel">
      <div className="relative rounded-2xl border border-[#E2DDD5] bg-[#FAF8F5] p-2 shadow-[0_24px_60px_-28px_rgba(30,58,43,0.35)] sm:p-3">
        <div className="overflow-hidden rounded-xl" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {media.map((m, i) => (
              <div key={m.key || i} className="min-w-0 flex-[0_0_100%]" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${media.length}`}>
                <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[#F4F1EB] to-[#EAF0EC]">
                  <Slide m={m} i={i} active={i === selected} onOpen={open} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {media.length > 1 && (
          <>
            <Arrow dir="prev" testid="carousel-prev-btn" onClick={() => embla && embla.scrollPrev()} />
            <Arrow dir="next" testid="carousel-next-btn" onClick={() => embla && embla.scrollNext()} />
            <span className="absolute right-5 top-5 rounded-full bg-[#1E3A2B]/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur" data-testid="carousel-counter">
              {selected + 1} / {media.length}
            </span>
          </>
        )}
      </div>
      <p className="mt-3 min-h-[1.5rem] text-center font-serif text-base text-[#1E3A2B]" data-testid="carousel-caption">{current?.caption || ""}</p>
      {media.length > 1 && <Thumbs media={media} selected={selected} onPick={(i) => embla && embla.scrollTo(i)} />}
      {/* Portail : le parent "sticky" crée un contexte d'empilement, sinon l'en-tête (z-50) recouvre la visionneuse. */}
      {zoom !== null && images[zoom] && createPortal(<Lightbox media={images} index={zoom} onClose={close} onMove={moveZoom} />, document.body)}
    </div>
  );
};

export default MediaCarousel;
