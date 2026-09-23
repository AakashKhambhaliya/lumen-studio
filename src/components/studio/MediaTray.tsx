"use client";

import { useRef, useState } from "react";
import { isHttpUrl } from "@/lib/catalog/payload";
import type { MediaField } from "@/lib/catalog/schema";
import type { MediaKind, MediaValues } from "@/lib/catalog/types";
import type { MentionAsset } from "@/lib/catalog/mentions";
import { cn } from "@/lib/cn";
import { uploadAccept } from "@/lib/uploads";
import type { PendingUpload } from "@/hooks/useUploads";
import { Popover } from "@/components/ui/Popover";
import { AudioIcon, CloseIcon, ImageIcon, LinkIcon, PlusIcon, VideoIcon } from "@/components/ui/icons";
import { MediaThumb } from "./MediaThumb";

interface MediaTrayProps {
  fields: MediaField[];
  media: MediaValues;
  uploads: PendingUpload[];
  tags: MentionAsset[];
  onUpload: (field: MediaField, files: File[]) => void;
  onAddUrl: (field: MediaField, url: string) => void;
  onRemove: (field: MediaField, index: number) => void;
  onDismissUpload: (id: string) => void;
}

const KIND_ICONS: Record<MediaKind, typeof ImageIcon> = { image: ImageIcon, video: VideoIcon, audio: AudioIcon };

function AddMediaButton({ field, onUpload, onAddUrl }: {
  field: MediaField;
  onUpload: MediaTrayProps["onUpload"];
  onAddUrl: MediaTrayProps["onAddUrl"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const Icon = KIND_ICONS[field.kind];

  // Not a <form>: this sits inside the composer form, and nested forms are
  // invalid HTML (the submit would also bubble to the composer).
  const submitUrl = (close: () => void) => {
    if (!isHttpUrl(url.trim())) return;
    onAddUrl(field, url.trim());
    setUrl("");
    close();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={uploadAccept(field.kind)}
        multiple={field.multiple}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onUpload(field, files);
          event.target.value = "";
        }}
      />
      <Popover
        label={`Add ${field.label.toLowerCase()}`}
        panelClassName="w-72"
        renderTrigger={({ triggerProps }) => (
          <button type="button" {...triggerProps} className="media-add" title={`Add ${field.label.toLowerCase()}`}>
            <Icon size={15} />
            <PlusIcon size={11} className="absolute bottom-1 right-1" />
          </button>
        )}
      >
        {({ close }) => (
          <div className="flex flex-col gap-2">
            <button type="button" className="menu-item" onClick={() => { close(); inputRef.current?.click(); }}>
              <Icon size={15} /> Upload {field.kind === "audio" ? "WAV" : field.kind === "video" ? "MP4" : "image"}
            </button>
            <div role="group" aria-label="Add from URL" className="flex items-center gap-2 border-t border-line pt-2">
              <LinkIcon size={14} className="shrink-0 text-muted" />
              <input
                type="url"
                className="field flex-1"
                placeholder="https://… public URL"
                aria-label={`${field.label} URL`}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  submitUrl(close);
                }}
              />
              <button type="button" className="chip" disabled={!isHttpUrl(url.trim())} onClick={() => submitUrl(close)}>Add</button>
            </div>
          </div>
        )}
      </Popover>
    </>
  );
}

export function MediaTray({ fields, media, uploads, tags, onUpload, onAddUrl, onRemove, onDismissUpload }: MediaTrayProps) {
  if (fields.length === 0) return null;
  const tagFor = (url: string, kind: MediaKind) => tags.find((tag) => tag.url === url && tag.kind === kind)?.tag;

  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
      {fields.map((field) => {
        const items = media[field.key] ?? [];
        const pending = uploads.filter((upload) => upload.fieldKey === field.key);
        const full = items.length + pending.filter((upload) => !upload.error).length >= field.maxItems;
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {field.label}
              {field.required ? "" : " · optional"}
              {field.multiple ? ` · ${items.length}/${field.maxItems}` : ""}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {items.map((url, index) => (
                <div key={`${url}-${index}`} className="group relative">
                  <MediaThumb kind={field.kind} url={url} className="size-14 rounded-xl" />
                  {tagFor(url, field.kind) && (
                    <span className="absolute inset-x-0 bottom-0 truncate rounded-b-xl bg-black/70 px-1 text-center text-[10px] font-semibold text-accent">
                      {tagFor(url, field.kind)}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${field.label.toLowerCase()} ${index + 1}`}
                    onClick={() => onRemove(field, index)}
                    className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full bg-black text-fg ring-1 ring-line group-hover:flex group-focus-within:flex"
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              ))}
              {pending.map((upload) => (
                <div key={upload.id} className="relative" title={upload.error ?? upload.name}>
                  <MediaThumb kind={upload.kind} url={upload.previewUrl} className={cn("size-14 rounded-xl", upload.error ? "opacity-40" : "opacity-60")} />
                  {upload.error ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-xl text-[10px] font-semibold text-red-300">Failed</span>
                  ) : (
                    <span className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded bg-white/20">
                      <span className="block h-full bg-accent transition-[width]" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={upload.error ? `Dismiss ${upload.name}` : `Cancel upload of ${upload.name}`}
                    onClick={() => onDismissUpload(upload.id)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black text-fg ring-1 ring-line"
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              ))}
              {!full && <AddMediaButton field={field} onUpload={onUpload} onAddUrl={onAddUrl} />}
            </div>
          </div>
        );
      })}
      {uploads.some((upload) => upload.error) && (
        <p role="alert" className="basis-full text-xs text-red-300">
          {uploads.filter((upload) => upload.error).map((upload) => upload.error).join(" ")}
        </p>
      )}
    </div>
  );
}
