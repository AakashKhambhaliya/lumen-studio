"use client";

import { useMemo, useState } from "react";
import { modeLabel } from "@/lib/catalog/schema";
import type { ModelMode, ModelSpec } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { Popover } from "@/components/ui/Popover";
import { CheckIcon, ChevronIcon, SearchIcon } from "@/components/ui/icons";

interface ModelPickerProps {
  models: ModelSpec[];
  value: ModelSpec;
  onChange: (model: ModelSpec) => void;
}

interface FamilyGroup {
  family: string;
  name: string;
  creator: string;
  models: ModelSpec[];
}

function groupByFamily(models: ModelSpec[]): FamilyGroup[] {
  const groups = new Map<string, FamilyGroup>();
  for (const model of models) {
    const group = groups.get(model.family) ?? { family: model.family, name: model.familyName, creator: model.creator, models: [] };
    group.models.push(model);
    groups.set(model.family, group);
  }
  return [...groups.values()];
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ModelMode | "all">("all");
  const modes = useMemo(() => [...new Set(models.map((model) => model.mode))], [models]);
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groupByFamily(models.filter((model) =>
      (mode === "all" || model.mode === mode) &&
      (!needle || `${model.familyName} ${model.workflowName} ${model.creator}`.toLowerCase().includes(needle))));
  }, [models, mode, query]);

  return (
    <Popover
      label="Choose a model"
      panelClassName="w-[min(26rem,calc(100vw-2rem))] p-0"
      renderTrigger={({ open, triggerProps }) => (
        <button type="button" {...triggerProps} className={cn("pill max-w-[16rem]", open && "pill-active")}>
          <span className="truncate font-semibold">{value.familyName}</span>
          <span className="truncate text-muted">{value.workflowName}</span>
          <ChevronIcon size={12} className="shrink-0 opacity-60" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col">
          <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-surface-raised p-3">
            <label className="flex items-center gap-2 rounded-xl border border-line bg-black/30 px-3">
              <SearchIcon size={14} className="text-muted" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  // Enter picks the first match instead of submitting the composer form.
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const first = groups[0]?.models[0];
                  if (first) {
                    onChange(first);
                    close();
                  }
                }}
                placeholder={`Search ${models.length} models`}
                aria-label="Search models"
                className="h-9 flex-1 bg-transparent text-sm focus:outline-none"
              />
            </label>
            {modes.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by mode">
                {(["all", ...modes] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={mode === item}
                    onClick={() => setMode(item)}
                    className={cn("chip", mode === item && "chip-active")}
                  >
                    {item === "all" ? "All" : modeLabel(item)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-2">
            {groups.length === 0 && <p className="p-4 text-center text-sm text-muted">No models match.</p>}
            {groups.map((group) => (
              <section key={group.family} className="mb-1">
                <h3 className="flex items-baseline justify-between px-2 pb-1 pt-2">
                  <span className="text-sm font-semibold">{group.name}</span>
                  <span className="text-[11px] text-muted">{group.creator}</span>
                </h3>
                {group.models.map((model) => {
                  const selected = model.id === value.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => { onChange(model); close(); }}
                      aria-current={selected || undefined}
                      className={cn("menu-item justify-between", selected && "text-accent")}
                    >
                      <span className="truncate">{model.workflowName}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="badge">{modeLabel(model.mode)}</span>
                        {selected ? <CheckIcon size={14} /> : <span className="w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
