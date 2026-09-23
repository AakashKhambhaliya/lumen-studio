"use client";

/* eslint-disable @next/next/no-img-element -- full-size Higgsfield output. */
import type { GenerationRecord } from "@/lib/generations";
import { humanize } from "@/lib/catalog/schema";
import { Dialog } from "@/components/ui/Dialog";

interface ResultViewerProps {
  record: GenerationRecord | null;
  onClose: () => void;
}

export function ResultViewer({ record, onClose }: ResultViewerProps) {
  const settings = Object.entries(record?.input.parameters ?? {}).filter(([, value]) => value !== undefined && typeof value !== "object");
  return (
    <Dialog open={record !== null} onClose={onClose} title={record?.modelName ?? ""} className="w-[min(96vw,64rem)]">
      {record && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3">
            {record.outputs.map((output) =>
              output.kind === "video" ? (
                <video key={output.url} src={output.url} controls autoPlay loop playsInline className="max-h-[65vh] w-full rounded-xl bg-black" />
              ) : output.kind === "image" ? (
                <img key={output.url} src={output.url} alt={record.input.prompt || "Generated image"} className="max-h-[65vh] w-full rounded-xl bg-black object-contain" />
              ) : (
                <audio key={output.url} src={output.url} controls className="w-full" />
              ),
            )}
          </div>
          {record.input.prompt && <p className="whitespace-pre-wrap text-sm text-fg/90">{record.input.prompt}</p>}
          {settings.length > 0 && (
            <dl className="flex flex-wrap gap-2 text-xs">
              {settings.map(([key, value]) => (
                <div key={key} className="badge gap-1">
                  <dt className="text-muted">{humanize(key)}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </Dialog>
  );
}
