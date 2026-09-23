"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  filterMentionAssets,
  findMentionQuery,
  findUnknownMentions,
  insertMention,
  tokenizeMentions,
  type MentionAsset,
} from "@/lib/catalog/mentions";
import type { MentionSyntax } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { MediaThumb } from "./MediaThumb";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  maxLength?: number;
  /** Tag syntax of the selected model; tagging is off when absent. */
  syntax?: MentionSyntax;
  assets: MentionAsset[];
}

// Mirrors the textarea's box and typography so highlights sit behind the tags.
const TEXT_METRICS = "px-1 py-1 text-[15px] leading-6 whitespace-pre-wrap break-words";
const MAX_HEIGHT = 220;

export function PromptInput({ value, onChange, onSubmit, placeholder, maxLength, syntax, assets }: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();
  const tagging = Boolean(syntax && assets.length > 0);

  const matches = useMemo(
    () => (tagging && mention ? filterMentionAssets(assets, mention.query) : []),
    [assets, mention, tagging],
  );
  const segments = useMemo(() => (syntax ? tokenizeMentions(value, syntax, assets) : []), [assets, syntax, value]);
  const unknownTags = useMemo(() => (syntax ? findUnknownMentions(value, syntax, assets) : []), [assets, syntax, value]);
  const menuOpen = matches.length > 0;
  const highlightedIndex = Math.min(activeIndex, Math.max(matches.length - 1, 0));

  // Auto-grow, keep the highlight overlay scrolled with the text, and restore
  // the caret after a programmatic insertion.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
    if (overlayRef.current) overlayRef.current.scrollTop = textarea.scrollTop;
    if (pendingCaret.current !== null) {
      textarea.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  const refreshMention = useCallback((textarea: HTMLTextAreaElement) => {
    setMention(tagging ? findMentionQuery(textarea.value, textarea.selectionStart) : null);
    setActiveIndex(0);
  }, [tagging]);

  const applyInsertion = (start: number, end: number, tag: string) => {
    const { text, caret } = insertMention(value, start, end, tag);
    pendingCaret.current = caret;
    setMention(null);
    onChange(text);
    textareaRef.current?.focus();
  };

  const selectAsset = (asset: MentionAsset) => {
    const textarea = textareaRef.current;
    if (!textarea || !mention) return;
    applyInsertion(mention.start, textarea.selectionStart, asset.tag);
  };

  const insertAtCaret = (tag: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    applyInsertion(start, textarea?.selectionEnd ?? start, tag);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((highlightedIndex + step + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectAsset(matches[highlightedIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMention(null);
        return;
      }
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        {syntax && (
          <div ref={overlayRef} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden text-transparent", TEXT_METRICS)}>
            {segments.map((segment, index) =>
              segment.tag ? (
                <mark key={index} className={cn("rounded text-transparent", segment.tag.valid ? "bg-accent/20 ring-1 ring-accent/40" : "bg-red-500/25 ring-1 ring-red-500/50")}>
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
            {"\n"}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          rows={2}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label="Prompt"
          role={tagging ? "combobox" : undefined}
          aria-autocomplete={tagging ? "list" : undefined}
          aria-expanded={tagging ? menuOpen : undefined}
          aria-controls={tagging ? listboxId : undefined}
          aria-activedescendant={menuOpen ? `${listboxId}-${highlightedIndex}` : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            refreshMention(event.target);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) refreshMention(event.currentTarget);
          }}
          onClick={(event) => refreshMention(event.currentTarget)}
          onBlur={() => setMention(null)}
          onScroll={(event) => {
            if (overlayRef.current) overlayRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
          className={cn("relative block w-full resize-none bg-transparent text-fg placeholder:text-muted/70 focus:outline-none", TEXT_METRICS)}
        />
        {menuOpen && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Attached media"
            className="absolute bottom-[calc(100%+8px)] left-0 z-40 w-72 rounded-2xl border border-line bg-surface-raised p-2 shadow-2xl shadow-black/60"
          >
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Attached media</p>
            {matches.map((asset, index) => (
              <div
                key={asset.tag}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectAsset(asset)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5",
                  index === highlightedIndex ? "bg-accent/10 text-accent" : "text-fg/80",
                )}
              >
                <MediaThumb kind={asset.kind} url={asset.url} className="size-9 rounded-lg" />
                <span className="text-sm font-medium">{asset.tag}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {tagging && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Tag</span>
          {assets.map((asset) => (
            <button
              key={asset.tag}
              type="button"
              title={`Insert ${asset.tag}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertAtCaret(asset.tag)}
              className="chip gap-1.5 pl-0.5"
            >
              <MediaThumb kind={asset.kind} url={asset.url} className="size-5 rounded-full" />
              {asset.tag}
            </button>
          ))}
          <span className="text-[11px] text-muted">or type @</span>
        </div>
      )}
      {unknownTags.length > 0 && (
        <p role="status" className="text-xs text-red-300">
          Not attached: {unknownTags.join(", ")}. Tags follow the order of your uploads.
        </p>
      )}
    </div>
  );
}
