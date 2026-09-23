"use client";

/* eslint-disable @next/next/no-img-element -- Higgsfield outputs live on
   arbitrary CDN hosts and are shown at full fidelity. */
import { useEffect, useState } from "react";
import { OUTPUT_RETENTION_MS, type GenerationRecord } from "@/lib/generations";
import { cn } from "@/lib/cn";
import { DownloadIcon, ReuseIcon, TrashIcon } from "@/components/ui/icons";

interface GenerationCardProps {
  record: GenerationRecord;
  onOpen: () => void;
  onReuse: () => void;
  onRemove: () => void;
  onCancel: () => Promise<string | null>;
}

const STATUS_TEXT: Record<GenerationRecord["status"], string> = {
  submitting: "Submitting…",
  queued: "Queued",
  in_progress: "Generating…",
  completed: "Done",
  failed: "Failed",
  nsfw: "Blocked by moderation",
  canceled: "Canceled",
  lost: "Unavailable",
};

function useElapsed(since: number, active: boolean): string {
  const [now, setNow] = useState(since);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active]);
  const seconds = Math.max(0, Math.round((now - since) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function GenerationCard({ record, onOpen, onReuse, onRemove, onCancel }: GenerationCardProps) {
  const running = ["submitting", "queued", "in_progress"].includes(record.status);
  const elapsed = useElapsed(record.createdAt, running);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const output = record.outputs[0];
  const expired = record.status === "completed" && renderedAt - record.createdAt > OUTPUT_RETENTION_MS;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className={cn("relative bg-black/40", record.output === "video" ? "aspect-video" : "aspect-square")}>
        {output ? (
          <button type="button" onClick={onOpen} className="block size-full" aria-label="Open result">
            {output.kind === "video" ? (
              <video src={output.url} className="size-full object-cover" muted loop playsInline preload="metadata"
                onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
                onMouseLeave={(event) => event.currentTarget.pause()} />
            ) : output.kind === "image" ? (
              <img src={output.url} alt={record.input.prompt || "Generated image"} className="size-full object-cover" loading="lazy" />
            ) : (
              <audio src={output.url} controls className="absolute inset-x-3 bottom-3" />
            )}
            {record.outputs.length > 1 && (
              <span className="badge absolute right-2 top-2 bg-black/70">+{record.outputs.length - 1}</span>
            )}
          </button>
        ) : (
          <div className={cn("flex size-full flex-col items-center justify-center gap-2 p-4 text-center", running && "shimmer")}>
            <span className={cn("text-sm font-semibold", running ? "text-fg" : "text-red-300")}>{STATUS_TEXT[record.status]}</span>
            {running && <span className="text-xs text-muted">{elapsed}</span>}
            {!running && record.error && <span className="line-clamp-4 text-xs text-muted">{record.error}</span>}
            {record.status === "queued" && (
              <button
                type="button"
                className="chip mt-1"
                onClick={async () => setCancelError(await onCancel())}
              >
                Cancel
              </button>
            )}
            {cancelError && <span className="text-xs text-red-300">{cancelError}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 min-h-10 text-sm text-fg/90">{record.input.prompt || <span className="text-muted">No prompt</span>}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted" title={record.modelName}>{record.modelName}</span>
          <div className="flex shrink-0 items-center">
            {output && !expired && (
              <a href={output.url} target="_blank" rel="noreferrer" download className="icon-button" aria-label="Open original in a new tab">
                <DownloadIcon size={14} />
              </a>
            )}
            <button type="button" onClick={onReuse} className="icon-button" aria-label="Reuse these settings">
              <ReuseIcon size={14} />
            </button>
            {!running && (
              <button type="button" onClick={onRemove} className="icon-button" aria-label="Remove from history">
                <TrashIcon size={14} />
              </button>
            )}
          </div>
        </div>
        {expired && <p className="text-[11px] text-muted">Higgsfield keeps outputs for 7 days; this link may have expired.</p>}
      </div>
    </article>
  );
}
