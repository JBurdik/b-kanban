import { useEffect, useRef, useState } from "react";
import { exportToSvg } from "@excalidraw/excalidraw";
import type { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useTheme } from "@/contexts/ThemeContext";
import type { CanvasData } from "./CanvasEditor";

async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Static, non-interactive render of a canvas scene, for the card drawer. */
export function CanvasPreview({ canvas }: { canvas: CanvasData }) {
  const { resolvedMode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const elements = JSON.parse(canvas.elements) as OrderedExcalidrawElement[];
        if (elements.length === 0) {
          if (!cancelled) setStatus("empty");
          return;
        }

        const files: BinaryFiles = {};
        for (const file of canvas.files) {
          if (!file.url) continue;
          try {
            files[file.fileId] = {
              id: file.fileId,
              mimeType: file.mimeType,
              dataURL: await urlToDataUrl(file.url),
              created: Date.now(),
            } as BinaryFileData;
          } catch {
            // renders as a missing-image placeholder
          }
        }
        if (cancelled) return;

        const svg = await exportToSvg({
          elements,
          appState: { ...JSON.parse(canvas.appState), theme: resolvedMode, exportBackground: true },
          files,
          exportPadding: 16,
        });
        if (cancelled) return;

        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.maxHeight = "100%";
        if (containerRef.current) {
          containerRef.current.replaceChildren(svg);
        }
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canvas.elements, canvas.appState, canvas.files, resolvedMode]);

  return (
    <div className="relative w-full h-40 rounded border border-dark-border bg-dark-bg overflow-hidden flex items-center justify-center">
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" />
      {status === "loading" && <p className="absolute text-xs text-dark-muted">Loading preview…</p>}
      {status === "empty" && <p className="absolute text-xs text-dark-muted">Empty canvas</p>}
      {status === "error" && <p className="absolute text-xs text-dark-muted">Preview unavailable</p>}
    </div>
  );
}
