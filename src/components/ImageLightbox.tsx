import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface LightboxImage {
  src: string;
  alt?: string;
}

interface LightboxContextValue {
  /** Open the lightbox with one or more images, starting at `index`. */
  open: (images: LightboxImage[] | string[], index?: number) => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

/** Open the shared image lightbox from anywhere under the provider. */
export function useImageLightbox(): LightboxContextValue {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useImageLightbox must be used within ImageLightboxProvider");
  return ctx;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.4;

function normalize(images: LightboxImage[] | string[]): LightboxImage[] {
  return images.map((img) => (typeof img === "string" ? { src: img } : img));
}

export function ImageLightboxProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [index, setIndex] = useState(0);

  const open = useCallback((imgs: LightboxImage[] | string[], i = 0) => {
    const list = normalize(imgs);
    if (list.length === 0) return;
    setImages(list);
    setIndex(Math.max(0, Math.min(i, list.length - 1)));
  }, []);

  const close = useCallback(() => setImages([]), []);

  // Delegated click handler: any <img> inside rendered rich text / comments
  // opens the lightbox. These images come from dangerouslySetInnerHTML, so we
  // can't wire React onClick directly.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.tagName !== "IMG") return;
      const container = target.closest(".rich-content, .comment-content");
      if (!container) return;
      // Use .src (the attribute value) not .currentSrc — on Windows/WebView2
      // currentSrc may return a Tauri-intercepted URL instead of the original.
      const src = (target as HTMLImageElement).src;
      if (!src) return;
      e.preventDefault();
      e.stopPropagation();
      // Gallery = every image in the same content block.
      const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
      const srcs = imgs.map((im) => ({ src: im.src, alt: im.alt }));
      const start = imgs.indexOf(target as HTMLImageElement);
      open(srcs, start < 0 ? 0 : start);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [open]);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {images.length > 0 && (
        <Lightbox
          images={images}
          index={index}
          setIndex={setIndex}
          onClose={close}
        />
      )}
    </LightboxContext.Provider>
  );
}

interface LightboxProps {
  images: LightboxImage[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}

function Lightbox({ images, index, setIndex, onClose }: LightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = images[index];
  const hasGallery = images.length > 1;

  const reset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Reset transform whenever the visible image changes.
  useEffect(() => {
    reset();
  }, [index, reset]);

  const zoomBy = useCallback((factor: number) => {
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor));
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const go = useCallback(
    (dir: number) => {
      setIndex((index + dir + images.length) % images.length);
    },
    [index, images.length, setIndex],
  );

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
          if (hasGallery) go(1);
          break;
        case "ArrowLeft":
          if (hasGallery) go(-1);
          break;
        case "+":
        case "=":
          zoomBy(ZOOM_STEP);
          break;
        case "-":
          zoomBy(1 / ZOOM_STEP);
          break;
        case "r":
        case "R":
          setRotation((r) => r + 90);
          break;
        case "0":
          reset();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, go, hasGallery, zoomBy, reset]);

  // Use native listener with {passive: false} — React's synthetic onWheel can't
  // call preventDefault() in WebView2 (Windows), causing page scroll instead of zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center select-none"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <ToolbarButton title="Zoom out (-)" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6m-3-3h6M19 11a8 8 0 11-16 0 8 8 0 0116 0z" transform="translate(0 0)" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11h6" /></svg>
        </ToolbarButton>
        <span className="text-white/80 text-xs tabular-nums w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarButton title="Zoom in (+)" onClick={() => zoomBy(ZOOM_STEP)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6m-3-3h6M19 11a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
        </ToolbarButton>
        <ToolbarButton title="Rotate (R)" onClick={() => setRotation((r) => r + 90)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </ToolbarButton>
        <ToolbarButton title="Reset (0)" onClick={reset}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </ToolbarButton>
        <a
          href={current.src}
          target="_blank"
          rel="noopener noreferrer"
          download
          title="Download"
          className="text-white/80 hover:text-white p-2 rounded hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </a>
        <ToolbarButton title="Close (Esc)" onClick={onClose}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </ToolbarButton>
      </div>

      {/* Gallery nav */}
      {hasGallery && (
        <>
          <NavButton side="left" onClick={(e) => { e.stopPropagation(); go(-1); }} />
          <NavButton side="right" onClick={(e) => { e.stopPropagation(); go(1); }} />
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm tabular-nums bg-black/40 px-3 py-1 rounded-full"
            onClick={(e) => e.stopPropagation()}
          >
            {index + 1} / {images.length}
          </div>
        </>
      )}

      {/* Image */}
      <img
        src={current.src}
        alt={current.alt || "Image"}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          scale > 1 ? reset() : zoomBy(ZOOM_STEP * 2);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="max-w-[92vw] max-h-[92vh] object-contain transition-transform duration-75"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
          cursor: scale > 1 ? (drag.current ? "grabbing" : "grab") : "zoom-in",
        }}
      />
    </div>
  );
}

function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="text-white/80 hover:text-white p-2 rounded hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );
}

function NavButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-3" : "right-3"} text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors`}
    >
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={side === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}
