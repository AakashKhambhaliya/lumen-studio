#!/usr/bin/env node
// Regenerates the Higgsfield model catalog in src/lib/catalog/generated/ from
// the public API documentation (https://docs.higgsfield.ai/docs/llms.txt).
//
// Every workflow page publishes its endpoint ID and complete JSON schema. This
// script normalizes those schemas (resolving $ref, collapsing nullable
// unions), annotates media inputs, and assigns each workflow to a studio.
//
//   npm run sync:models

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_BASE = "https://docs.higgsfield.ai";
const OUTPUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/catalog/generated");
const CATEGORY_PAGES = { image: "/docs/models/image-generation", video: "/docs/models/video-generation" };

// Training and account-management workflows are not generation endpoints.
const SKIPPED_WORKFLOWS = new Set(["soul-id/create-character"]);

// Seedance resolves @image1…/@video1…/@audio1… against its ordered reference
// arrays. Cinema Studio's syntax is detected from its usage notes instead.
const AT_MENTION_FAMILIES = new Set(["seedance-2", "seedance-2-5"]);

const MEDIA_INPUTS = {
  image_url: { kind: "image", role: "primary" },
  image_urls: { kind: "image", role: "references" },
  image_reference_url: { kind: "image", role: "reference" },
  first_frame_url: { kind: "image", role: "start" },
  end_image_url: { kind: "image", role: "end" },
  last_image_url: { kind: "image", role: "end" },
  last_frame_url: { kind: "image", role: "end" },
  video_url: { kind: "video", role: "source" },
  video_urls: { kind: "video", role: "references" },
  audio_url: { kind: "audio", role: "primary" },
  audio_urls: { kind: "audio", role: "references" },
};

const WORKFLOW_MODES = [
  [/video-edit$/, "edit"],
  [/video-extend$/, "extend"],
  [/(reference|image-reference|video-reference)/, "reference"],
  [/first-last-frame/, "frames"],
  [/image-to-video/, "image"],
  [/text-to-video/, "text"],
];

async function fetchDoc(docPath) {
  const url = `${DOCS_BASE}${docPath}.md`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

function parseCategory(markdown, output) {
  const pattern = /<a className="featured-model-card" href="\/docs\/models\/([a-z0-9-]+)">([\s\S]*?)<\/a>/g;
  return [...markdown.matchAll(pattern)].map(([, slug, body]) => ({
    slug,
    output,
    creator: body.match(/featured-model-meta"><span>([^<]+)<\/span>/)?.[1]?.trim() ?? "Higgsfield",
    description: body.match(/featured-model-description">([^<]+)</)?.[1]?.trim() ?? "",
  }));
}

function parseWorkflow(markdown) {
  const heading = markdown.match(/^# (.+?)(?: API)?$/m)?.[1] ?? "";
  const [familyName, workflowName = ""] = heading.split(/\s+—\s+/);
  const schemaText = markdown.match(/Complete JSON schema">\s*```json[^\n]*\n([\s\S]*?)```/)?.[1];
  const notesBlock = markdown.match(/## Usage notes\s*\n([\s\S]*?)\n## /)?.[1] ?? "";
  return {
    familyName: familyName.trim(),
    workflowName: workflowName.trim(),
    endpoint: markdown.match(/\*\*Endpoint ID:\*\* `([^`]+)`/)?.[1],
    schema: schemaText ? JSON.parse(schemaText) : null,
    notes: [...notesBlock.matchAll(/^\* (.+)$/gm)].map(([, note]) => note.replace(/\\([_<>*])/g, "$1").trim()),
  };
}

function resolveRef(schema, root) {
  if (!schema?.$ref) return schema;
  const target = schema.$ref.replace(/^#\//, "").split("/").reduce((node, key) => node?.[key], root);
  const { $ref: _ref, ...rest } = schema;
  return { ...resolveRef(target, root), ...rest };
}

const KEPT_KEYWORDS = ["type", "title", "description", "enum", "default", "minimum", "maximum", "multipleOf",
  "minLength", "maxLength", "minItems", "maxItems", "required", "format"];

function normalizeSchema(source, root) {
  let schema = resolveRef(source, root);
  const alternatives = schema?.anyOf ?? schema?.oneOf;
  if (alternatives) {
    const concrete = alternatives.map((option) => resolveRef(option, root)).filter((option) => option.type !== "null");
    const { anyOf: _anyOf, oneOf: _oneOf, ...rest } = schema;
    schema = concrete.length === 1 ? { ...concrete[0], ...rest } : { ...rest, type: "string" };
  }
  const normalized = Object.fromEntries(KEPT_KEYWORDS.filter((key) => schema[key] !== undefined && schema[key] !== null)
    .map((key) => [key, schema[key]]));
  normalized.type ??= schema.enum ? typeof schema.enum[0] === "number" ? "number" : "string" : "string";
  if (schema.items) normalized.items = normalizeSchema(schema.items, root);
  if (schema.properties) {
    normalized.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, property]) => [key, normalizeSchema(property, root)]),
    );
  }
  return normalized;
}

// Collects "provide at least one of" rules expressed as if/else chains, e.g.
// { if: { required: ["image_urls"] }, else: { if: …, else: { required: [...] } } }.
function oneOfRequired(schema) {
  const keys = [];
  let node = schema;
  while (node?.if?.required?.length === 1) {
    keys.push(node.if.required[0]);
    node = node.else;
  }
  if (keys.length > 0 && node?.required?.length === 1) keys.push(node.required[0]);
  return keys.length > 1 ? keys : undefined;
}

function workflowMode(output, workflowSlug, inputs, required) {
  if (output === "image") {
    const mediaKeys = Object.keys(inputs).filter((key) => inputs[key].media);
    if (mediaKeys.some((key) => required.includes(key))) return "edit";
    return mediaKeys.length > 0 ? "generate-edit" : "generate";
  }
  return WORKFLOW_MODES.find(([pattern]) => pattern.test(workflowSlug))?.[1] ??
    (Object.values(inputs).some((input) => input.media) ? "reference" : "text");
}

function studioFor(card) {
  if (card.output === "image") return "image";
  if (card.slug === "cinema-studio-4") return "cinema";
  if (card.slug.endsWith("motion-control") || card.slug === "genjutsu") return "motion";
  return "video";
}

function mentionSyntax(familySlug, notes, inputs) {
  const kinds = ["image", "video", "audio"].filter((kind) => inputs[`${kind}_urls`]);
  if (kinds.length === 0) return undefined;
  if (notes.some((note) => note.includes("<<<image_1>>>"))) return { format: "angle", kinds };
  if (AT_MENTION_FAMILIES.has(familySlug)) return { format: "at", kinds };
  return undefined;
}

function buildModel(card, workflowSlug, parsed) {
  const required = parsed.schema.required ?? [];
  const inputs = Object.fromEntries(Object.entries(parsed.schema.properties ?? {}).map(([key, property]) => {
    const input = normalizeSchema(property, parsed.schema);
    return [key, MEDIA_INPUTS[key] ? { ...input, media: MEDIA_INPUTS[key] } : input];
  }));
  const familyName = parsed.familyName.replace(/^HappyHorse/, "Happy Horse");
  return {
    id: `${card.slug}/${workflowSlug}`,
    endpoint: parsed.endpoint,
    family: card.slug,
    familyName,
    workflow: workflowSlug,
    workflowName: parsed.workflowName.replace(/\s*·\s*/g, " "),
    creator: card.creator,
    description: card.description,
    output: card.output,
    studio: studioFor(card),
    mode: workflowMode(card.output, workflowSlug, inputs, required),
    required,
    ...(oneOfRequired(parsed.schema) ? { requiresOneOf: oneOfRequired(parsed.schema) } : {}),
    ...(mentionSyntax(card.slug, parsed.notes, inputs) ? { mentions: mentionSyntax(card.slug, parsed.notes, inputs) } : {}),
    notes: parsed.notes.filter((note) => !/example\.com|placeholder/i.test(note)),
    docsUrl: `${DOCS_BASE}/docs/models/${card.slug}/${workflowSlug}`,
    inputs,
  };
}

async function main() {
  const cards = [];
  for (const [output, page] of Object.entries(CATEGORY_PAGES)) cards.push(...parseCategory(await fetchDoc(page), output));

  const byStudio = { image: [], video: [], cinema: [], motion: [] };
  for (const card of cards) {
    const familyPage = await fetchDoc(`/docs/models/${card.slug}`);
    const workflowSlugs = [...new Set(
      [...familyPage.matchAll(new RegExp(`/docs/models/${card.slug}/([a-z0-9-]+)`, "g"))].map(([, slug]) => slug),
    )].filter((slug) => !SKIPPED_WORKFLOWS.has(`${card.slug}/${slug}`));

    for (const workflowSlug of workflowSlugs) {
      const parsed = parseWorkflow(await fetchDoc(`/docs/models/${card.slug}/${workflowSlug}`));
      if (!parsed.endpoint || !parsed.schema) {
        console.warn(`skip ${card.slug}/${workflowSlug}: no endpoint or schema`);
        continue;
      }
      const model = buildModel(card, workflowSlug, parsed);
      byStudio[model.studio].push(model);
    }
  }

  // Emitted as typed modules so `tsc` checks every model against ModelSpec.
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const [studio, models] of Object.entries(byStudio)) {
    const source = [
      `// Generated by scripts/sync-models.mjs from ${DOCS_BASE}/docs/llms.txt. Do not edit; run \`npm run sync:models\`.`,
      `import type { ModelSpec } from "../types";`,
      ``,
      `export const models: ModelSpec[] = ${JSON.stringify(models, null, 2)};`,
      ``,
    ].join("\n");
    await fs.writeFile(path.join(OUTPUT_DIR, `${studio}.ts`), source);
  }
  const counts = Object.entries(byStudio).map(([studio, models]) => `${studio}=${models.length}`).join(" ");
  console.log(`Synced ${Object.values(byStudio).flat().length} Higgsfield workflows (${counts}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
