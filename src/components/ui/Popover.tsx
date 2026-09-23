"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PopoverProps {
  /** Renders the trigger; spread `triggerProps` onto a button. */
  renderTrigger: (state: { open: boolean; triggerProps: TriggerProps }) => ReactNode;
  children: (state: { close: () => void }) => ReactNode;
  label: string;
  side?: "top" | "bottom";
  align?: "start" | "end";
  panelClassName?: string;
}

interface TriggerProps {
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog";
  onClick: () => void;
}

/** A click-toggled panel that closes on outside click, Escape or `close()`. */
export function Popover({ renderTrigger, children, label, side = "top", align = "start", panelClassName }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector<HTMLElement>("[aria-controls]")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {renderTrigger({
        open,
        triggerProps: {
          "aria-expanded": open,
          "aria-controls": panelId,
          "aria-haspopup": "dialog",
          onClick: () => setOpen((value) => !value),
        },
      })}
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-40 max-h-[min(70vh,34rem)] overflow-y-auto rounded-2xl border border-line bg-surface-raised p-3 shadow-2xl shadow-black/60",
            side === "top" ? "bottom-[calc(100%+10px)]" : "top-[calc(100%+10px)]",
            align === "start" ? "left-0" : "right-0",
            panelClassName,
          )}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}
