'use client';

import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Fullscreen photo viewer.
 * Desktop: ‹/› buttons + arrow-key navigation, click backdrop to close.
 * Mobile: horizontal scroll-snap (TikTok / iOS gallery style) + swipe.
 *
 * Props:
 *   photos: [{ url, eventName?, date? }]
 *   index: starting index
 *   onClose: () => void
 *   selectedUrls?: string[]                     — when provided, shows a select toggle
 *   onToggleSelect?: (url: string) => void
 */
export default function PhotoLightbox({
  photos,
  index = 0,
  onClose,
  selectedUrls,
  onToggleSelect,
}) {
  const [current, setCurrent] = useState(index);
  const [isMobile, setIsMobile] = useState(false);
  const trackRef = useRef(null);
  const settling = useRef(false);
  const selectable = typeof onToggleSelect === 'function' && Array.isArray(selectedUrls);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard nav (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') setCurrent((c) => Math.min(c + 1, photos.length - 1));
      else if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0));
      else if (selectable && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        const url = photos[current]?.url;
        if (url) onToggleSelect(url);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, current, selectable, onClose, onToggleSelect, photos]);

  // On mobile, scroll-snap to the active slide when index changes from outside
  useEffect(() => {
    if (!isMobile || !trackRef.current) return;
    const el = trackRef.current.children[current];
    if (el) {
      settling.current = true;
      el.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
      setTimeout(() => { settling.current = false; }, 50);
    }
  }, [isMobile, current]);

  const onScroll = () => {
    if (settling.current || !trackRef.current) return;
    const w = trackRef.current.clientWidth;
    const idx = Math.round(trackRef.current.scrollLeft / w);
    if (idx !== current) setCurrent(idx);
  };

  if (!photos?.length) return null;
  const photo = photos[current];
  const isSelected = selectable && selectedUrls.includes(photo?.url);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 text-white shrink-0 gap-2">
        <div className="text-sm min-w-0 flex-1">
          <span className="font-bold">{current + 1}</span>
          <span className="text-white/50"> / {photos.length}</span>
          {photo?.eventName && (
            <span className="ml-3 text-[10px] sm:text-xs uppercase tracking-widest text-white/60 truncate">{photo.eventName}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Stage */}
      {isMobile ? (
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {photos.map((p, i) => (
            <div
              key={i}
              className="w-full h-full shrink-0 snap-center flex items-center justify-center px-2"
            >
              <img
                src={p.url}
                alt=""
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <button
            onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
            disabled={current === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Previous"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>

          <img
            key={photo.url}
            src={photo.url}
            alt=""
            className="max-h-[80vh] max-w-[90vw] object-contain animate-in fade-in duration-200 select-none"
            draggable={false}
          />

          <button
            onClick={() => setCurrent((c) => Math.min(c + 1, photos.length - 1))}
            disabled={current === photos.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Next"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>
      )}

      {/* Selection bar (only when selectable) */}
      {selectable && (
        <div className="shrink-0 px-4 py-3 border-t border-white/10 flex items-center justify-between gap-3 bg-black/40">
          <p className="text-[11px] text-white/60 font-bold uppercase tracking-widest">
            {selectedUrls.length} selected
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(photo.url); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              isSelected
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Check className={`w-4 h-4 ${isSelected ? '' : 'opacity-40'}`} />
            {isSelected ? 'Selected' : 'Select photo'}
          </button>
        </div>
      )}

      {/* Thumbnail strip (desktop only) */}
      {!isMobile && photos.length > 1 && (
        <div className="shrink-0 px-4 py-3 border-t border-white/10">
          <div className="flex gap-2 overflow-x-auto justify-center">
            {photos.map((p, i) => {
              const sel = selectable && selectedUrls.includes(p.url);
              return (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`relative shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition ${
                    i === current ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  {sel && (
                    <span className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
