import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

const whatsappLink = "https://wa.me/2349030578183?text=Hello%2C%20I%20would%20like%20to%20know%20more%20about%20Learnpedia.";
const buttonSize = 56;
const viewportPadding = 24;

interface FloatingPosition {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

function clampPosition(position: FloatingPosition): FloatingPosition {
  return {
    x: Math.max(8, Math.min(position.x, window.innerWidth - buttonSize - 8)),
    y: Math.max(8, Math.min(position.y, window.innerHeight - buttonSize - 8)),
  };
}

export function WhatsAppFloat() {
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const [hidden, setHidden] = useState(false);
  const dragState = useRef<DragState | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    setPosition(clampPosition({
      x: window.innerWidth - buttonSize - viewportPadding,
      y: window.innerHeight - buttonSize - viewportPadding,
    }));

    const handleResize = () => {
      setPosition((current) => current ? clampPosition(current) : current);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    didDrag.current = false;
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position?.x ?? 0,
      originY: position?.y ?? 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!didDrag.current && Math.hypot(deltaX, deltaY) < 5) return;
    didDrag.current = true;
    setPosition(clampPosition({ x: drag.originX + deltaX, y: drag.originY + deltaY }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragState.current?.pointerId === event.pointerId) dragState.current = null;
  };

  const handleOpenWhatsApp = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    window.open(whatsappLink, "_blank", "noopener,noreferrer");
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    hidden ? (
      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label="Show WhatsApp contact button"
        title="Show WhatsApp contact button"
        className="fixed bottom-5 right-5 z-[1000] inline-flex h-10 items-center gap-2 rounded-full bg-background px-3 text-sm font-medium text-foreground shadow-lg ring-1 ring-border transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] sm:bottom-6 sm:right-6"
      >
        <FaWhatsapp aria-hidden="true" className="h-5 w-5 text-[#25D366]" />
        <span>Contact</span>
      </button>
    ) : position ? (
      <div
        className="fixed z-[1000]"
        style={{ left: position.x, top: position.y, touchAction: "none" }}
      >
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleOpenWhatsApp}
          aria-label="Message Learnpedia on WhatsApp. Drag to move."
          title="Message us on WhatsApp (drag to move)"
          className="inline-flex h-14 w-14 cursor-grab touch-none items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-colors hover:bg-[#20bd5a] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <FaWhatsapp aria-hidden="true" className="h-8 w-8" />
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide WhatsApp contact button"
          title="Hide WhatsApp contact button"
          className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    ) : null,
    document.body,
  );
}
