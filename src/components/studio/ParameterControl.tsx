"use client";

import { useId } from "react";
import { allowsAuto, humanize, rangeOptions, type ParameterField } from "@/lib/catalog/schema";
import type { InputSchema, ParameterValue } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/ui/Switch";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";

interface ParameterControlProps {
  field: ParameterField;
  value: ParameterValue | undefined;
  onChange: (value: ParameterValue | undefined) => void;
  /** `compact`: a pill in the prompt bar; `full`: a labeled row in a panel. */
  variant?: "compact" | "full";
  /** A visible label is rendered outside the control (compact variant). */
  labelled?: boolean;
}

const AUTO = "";

export function formatOption(key: string, value: string | number): string {
  if (key === "duration" && typeof value === "number") return `${value}s`;
  if (typeof value === "number" || /^\d+(:\d+)?$|^\d+[kp]$/i.test(value)) return String(value).toUpperCase().replace(/(\d)P$/, "$1p");
  return humanize(value);
}

function isRgbObject(schema: InputSchema): boolean {
  const rgb = schema.properties?.rgb;
  return schema.type === "object" && rgb?.type === "array" && rgb.items?.type === "integer" && rgb.maxItems === 3;
}

const toHex = (rgb: unknown) =>
  Array.isArray(rgb) && rgb.length === 3
    ? `#${rgb.map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`
    : "#000000";
const fromHex = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

function PrimitiveInput({ schema, value, onChange, label, id }: {
  schema: InputSchema;
  value: unknown;
  onChange: (value: ParameterValue | undefined) => void;
  label: string;
  id?: string;
}) {
  if (schema.type === "boolean") {
    return <Switch id={id} label={label} checked={value === true} onChange={onChange} />;
  }
  if (schema.type === "integer" || schema.type === "number") {
    return (
      <input
        id={id}
        type="number"
        inputMode="numeric"
        aria-label={label}
        className="field w-28"
        min={schema.minimum}
        max={schema.maximum}
        step={schema.multipleOf ?? (schema.type === "integer" ? 1 : "any")}
        placeholder={schema.minimum !== undefined ? `${schema.minimum}–${schema.maximum ?? "∞"}` : "Auto"}
        value={typeof value === "number" ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      />
    );
  }
  const long = (schema.maxLength ?? 0) > 200;
  const Tag = long ? "textarea" : "input";
  return (
    <Tag
      id={id}
      aria-label={label}
      className={cn("field w-full", long && "min-h-20 resize-y")}
      maxLength={schema.maxLength}
      placeholder={schema.format === "uuid" ? "UUID" : "Optional"}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value || undefined)}
    />
  );
}

/** Rows of objects with primitive properties, e.g. Kling multi-shot prompts or Recraft colors. */
function ObjectListInput({ schema, value, onChange, label }: {
  schema: InputSchema;
  value: unknown;
  onChange: (value: ParameterValue | undefined) => void;
  label: string;
}) {
  const itemSchema = schema.items!;
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const max = schema.maxItems ?? 10;
  const setRows = (next: Record<string, unknown>[]) => onChange(next.length ? next : undefined);
  const emptyRow = () => (isRgbObject(itemSchema) ? { rgb: [255, 255, 255] } : {});

  return (
    <div className="flex w-full flex-col gap-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          {Object.entries(itemSchema.properties ?? {}).map(([key, propertySchema]) =>
            key === "rgb" && isRgbObject(itemSchema) ? (
              <input
                key={key}
                type="color"
                aria-label={`${label} ${index + 1}`}
                className="h-8 w-12 cursor-pointer rounded border border-line bg-transparent"
                value={toHex(row.rgb)}
                onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, rgb: fromHex(event.target.value) } : item)))}
              />
            ) : (
              <PrimitiveInput
                key={key}
                schema={propertySchema}
                label={`${label} ${index + 1} ${humanize(key)}`}
                value={row[key]}
                onChange={(next) => setRows(rows.map((item, i) => (i === index ? { ...item, [key]: next } : item)))}
              />
            ),
          )}
          <button type="button" className="icon-button" aria-label={`Remove ${label} ${index + 1}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>
            <TrashIcon size={14} />
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button type="button" className="chip self-start" onClick={() => setRows([...rows, emptyRow()])}>
          <PlusIcon size={12} /> Add
        </button>
      )}
    </div>
  );
}

function FieldInput({ field, value, onChange, id, compact, labelled = false }: {
  field: ParameterField;
  value: ParameterValue | undefined;
  onChange: (value: ParameterValue | undefined) => void;
  id: string;
  compact: boolean;
  labelled?: boolean;
}) {
  const { schema, key, label } = field;
  const options = schema.enum ?? rangeOptions(schema);

  if (options) {
    const auto = allowsAuto(field);
    return (
      <select
        id={id}
        aria-label={label}
        className={compact ? "pill-select" : "field w-full"}
        value={value === undefined ? AUTO : String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === AUTO) return onChange(undefined);
          onChange(schema.type === "integer" || schema.type === "number" ? Number(raw) : raw);
        }}
      >
        {auto && <option value={AUTO}>{compact && !labelled ? `${label}: Auto` : "Auto"}</option>}
        {options.map((option) => (
          <option key={String(option)} value={String(option)}>{formatOption(key, option)}</option>
        ))}
      </select>
    );
  }
  if (schema.type === "array" && schema.items?.type === "object") {
    return <ObjectListInput schema={schema} value={value} onChange={onChange} label={label} />;
  }
  if (schema.type === "array") {
    return (
      <textarea
        id={id}
        aria-label={label}
        className="field min-h-16 w-full resize-y"
        placeholder="One per line"
        value={Array.isArray(value) ? value.join("\n") : ""}
        onChange={(event) => {
          const items = event.target.value.split("\n").map((item) => item.trim()).filter(Boolean);
          onChange(items.length ? items : undefined);
        }}
      />
    );
  }
  if (isRgbObject(schema)) {
    const rgb = (value as { rgb?: number[] } | undefined)?.rgb;
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label={label}
          className="h-8 w-12 cursor-pointer rounded border border-line bg-transparent"
          value={toHex(rgb)}
          onChange={(event) => onChange({ rgb: fromHex(event.target.value) })}
        />
        {rgb && <button type="button" className="chip" onClick={() => onChange(undefined)}>Clear</button>}
      </div>
    );
  }
  return <PrimitiveInput id={id} schema={schema} value={value} onChange={onChange} label={label} />;
}

export function ParameterControl({ field, value, onChange, variant = "full", labelled = false }: ParameterControlProps) {
  const id = useId();
  if (variant === "compact") {
    return <FieldInput field={field} value={value} onChange={onChange} id={id} compact labelled={labelled} />;
  }
  const inline = field.schema.type === "boolean";
  return (
    <div className={cn("flex gap-3", inline ? "items-center justify-between" : "flex-col")}>
      <label htmlFor={id} className="min-w-0">
        <span className="block text-xs font-semibold text-fg/90">{field.label}</span>
        {field.schema.description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">{field.schema.description}</span>
        )}
      </label>
      <FieldInput field={field} value={value} onChange={onChange} id={id} compact={false} />
    </div>
  );
}
