"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import type { StudioConfig } from "@/config/studios";
import { getMentionAssets } from "@/lib/catalog/mentions";
import { buildPayload } from "@/lib/catalog/payload";
import { PRIMARY_PARAMETERS, getMediaFields, getParameterFields, rangeOptions, type MediaField, type ParameterField } from "@/lib/catalog/schema";
import type { ModelSpec, ParameterValue } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { createDraft, draftFromInput, isDraft, switchModel, toGenerationInput, type StudioDraft } from "@/lib/draft";
import type { GenerationRecord } from "@/lib/generations";
import { useStoredState } from "@/hooks/useStoredState";
import { useUploads } from "@/hooks/useUploads";
import { useGenerations } from "@/components/shell/GenerationsProvider";
import { useSession } from "@/components/shell/SessionProvider";
import { Popover } from "@/components/ui/Popover";
import { SlidersIcon, SparkIcon } from "@/components/ui/icons";
import { GenerationCard } from "./GenerationCard";
import { MediaTray } from "./MediaTray";
import { ModelPicker } from "./ModelPicker";
import { ParameterControl } from "./ParameterControl";
import { PromptInput } from "./PromptInput";
import { ResultViewer } from "./ResultViewer";

interface StudioProps {
  config: StudioConfig;
  models: ModelSpec[];
}

function withMedia(draft: StudioDraft, field: MediaField, url: string): StudioDraft {
  const current = draft.media[field.key] ?? [];
  const next = field.multiple ? [...current, url].slice(0, field.maxItems) : [url];
  return { ...draft, media: { ...draft.media, [field.key]: next } };
}

function splitParameters(fields: ParameterField[], featuredKeys: string[]) {
  const featured = featuredKeys.flatMap((key) => fields.filter((field) => field.key === key));
  const primary = PRIMARY_PARAMETERS.flatMap((key) =>
    fields.filter((field) => field.key === key && !featuredKeys.includes(key) && (field.schema.enum || rangeOptions(field.schema))));
  const used = new Set([...featured, ...primary].map((field) => field.key));
  return { featured, primary, advanced: fields.filter((field) => !used.has(field.key)) };
}

export function Studio({ config, models }: StudioProps) {
  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const defaultModel = modelsById.get(config.defaultModelId) ?? models[0];
  const fallbackDraft = useMemo(() => createDraft(defaultModel), [defaultModel]);
  const [storedDraft, setDraft] = useStoredState(`draft.${config.id}.v1`, fallbackDraft, isDraft);
  // A stored draft may reference a model removed by a catalog sync.
  const model = modelsById.get(storedDraft.modelId) ?? defaultModel;
  const draft = model.id === storedDraft.modelId ? storedDraft : fallbackDraft;

  const { session, openSettings } = useSession();
  const { records, submit, cancel, remove } = useGenerations(config.id);
  const [viewing, setViewing] = useState<GenerationRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const composerRef = useRef<HTMLFormElement>(null);

  const mediaFields = useMemo(() => getMediaFields(model), [model]);
  const { featured, primary, advanced } = useMemo(
    () => splitParameters(getParameterFields(model), config.featured?.keys ?? []),
    [model, config.featured],
  );

  const updateDraft = useCallback((change: Partial<StudioDraft>) => {
    setFeedback(null);
    setDraft((current) => ({ ...(isDraft(current) && current.modelId === model.id ? current : draft), ...change }));
  }, [setDraft, model.id, draft]);

  const setParameter = (key: string, value: ParameterValue | undefined) =>
    updateDraft({ parameters: { ...draft.parameters, [key]: value } });

  const onUploaded = useCallback((fieldKey: string, url: string) => {
    const field = mediaFields.find((candidate) => candidate.key === fieldKey);
    if (field) setDraft((current) => withMedia(current, field, url));
  }, [mediaFields, setDraft]);
  const { uploads, upload, discard } = useUploads(onUploaded);

  const mentionAssets = useMemo(() => getMentionAssets(model, draft.media), [model, draft.media]);
  const { issues } = useMemo(() => buildPayload(model, toGenerationInput(draft)), [model, draft]);
  const uploading = uploads.some((item) => !item.error);
  const blocker = uploading ? "Wait for uploads to finish." : issues[0]?.message ?? null;
  const connected = session?.connected ?? false;

  const handleModelChange = (next: ModelSpec) => {
    setFeedback(null);
    setDraft(switchModel(draft, model, next));
  };

  const handleGenerate = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!connected) return openSettings();
    if (blocker) return setFeedback(blocker);
    setSubmitting(true);
    setFeedback(null);
    const result = await submit(model, toGenerationInput(draft));
    setSubmitting(false);
    if (!result.ok) setFeedback(result.message);
  };

  const handleReuse = (record: GenerationRecord) => {
    const target = modelsById.get(record.modelId);
    if (!target) return setFeedback("That model is no longer in the catalog.");
    setDraft(draftFromInput(target, record.input));
    composerRef.current?.querySelector("textarea")?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section aria-label={`${config.title} results`} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6 sm:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
          <p className="text-sm text-muted">{config.tagline} · {models.length} models</p>
        </header>
        {records.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
            {records.map((record) => (
              <GenerationCard
                key={record.id}
                record={record}
                onOpen={() => setViewing(record)}
                onReuse={() => handleReuse(record)}
                onRemove={() => remove(record.id)}
                onCancel={() => cancel(record.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
            <SparkIcon size={28} className="text-accent" />
            <h2 className="text-lg font-semibold">Nothing here yet</h2>
            <p className="text-sm text-muted">
              Pick a model, describe what you want and press Generate. Results appear here and stay in this browser.
            </p>
            {session && !connected && (
              <button type="button" className="button-primary mt-2" onClick={openSettings}>Connect Higgsfield</button>
            )}
          </div>
        )}
      </section>

      <div className="border-t border-line bg-canvas/85 px-3 py-3 backdrop-blur sm:px-6">
        <form ref={composerRef} onSubmit={handleGenerate} className="mx-auto flex max-w-5xl flex-col gap-3 rounded-3xl border border-line bg-surface p-4 shadow-2xl shadow-black/40">
          <MediaTray
            fields={mediaFields}
            media={draft.media}
            uploads={uploads}
            tags={mentionAssets}
            onUpload={upload}
            onAddUrl={(field, url) => setDraft((current) => withMedia(current, field, url))}
            onRemove={(field, index) =>
              updateDraft({ media: { ...draft.media, [field.key]: (draft.media[field.key] ?? []).filter((_, i) => i !== index) } })}
            onDismissUpload={discard}
          />

          {featured.length > 0 && (
            <details open className="rounded-2xl border border-line bg-black/20 p-3">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted">
                {config.featured?.title}
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {featured.map((field) => (
                  <label key={field.key} className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted">{field.label}</span>
                    <ParameterControl field={field} value={draft.parameters[field.key]} onChange={(value) => setParameter(field.key, value)} variant="compact" labelled />
                  </label>
                ))}
              </div>
            </details>
          )}

          {model.inputs.prompt && (
            <PromptInput
              value={draft.prompt}
              onChange={(prompt) => updateDraft({ prompt })}
              onSubmit={() => void handleGenerate()}
              placeholder={config.promptPlaceholder}
              maxLength={model.inputs.prompt.maxLength}
              syntax={model.mentions}
              assets={mentionAssets}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <ModelPicker models={models} value={model} onChange={handleModelChange} />
            {primary.map((field) => (
              <ParameterControl key={field.key} field={field} value={draft.parameters[field.key]} onChange={(value) => setParameter(field.key, value)} variant="compact" />
            ))}
            {(advanced.length > 0 || model.notes.length > 0) && (
              <Popover
                label="More settings"
                side="top"
                panelClassName="w-[min(24rem,calc(100vw-2rem))]"
                renderTrigger={({ open, triggerProps }) => (
                  <button type="button" {...triggerProps} className={cn("pill", open && "pill-active")}>
                    <SlidersIcon size={14} /> More
                  </button>
                )}
              >
                {() => (
                  <div className="flex flex-col gap-4 p-1">
                    {advanced.map((field) => (
                      <ParameterControl key={field.key} field={field} value={draft.parameters[field.key]} onChange={(value) => setParameter(field.key, value)} />
                    ))}
                    <div className="border-t border-line pt-3 text-xs text-muted">
                      <p className="mb-1 font-semibold text-fg/80">About {model.familyName} · {model.workflowName}</p>
                      {model.description && <p className="mb-2">{model.description}</p>}
                      <ul className="list-disc space-y-1 pl-4">
                        {model.notes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                      <a href={model.docsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-accent hover:underline">API reference</a>
                    </div>
                  </div>
                )}
              </Popover>
            )}
            <div className="ml-auto flex items-center gap-3">
              {feedback && <p role="alert" className="max-w-xs text-right text-xs text-red-300">{feedback}</p>}
              <button
                type="submit"
                className="button-primary"
                disabled={submitting}
                title={connected ? "Generate (Ctrl/⌘ + Enter)" : "Connect your Higgsfield API key"}
              >
                {submitting ? "Starting…" : connected ? "Generate" : "Connect to generate"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ResultViewer record={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
