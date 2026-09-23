import type { MediaKind, MediaValues, MentionSyntax, ModelSpec } from "./types";

// Prompt asset tags reference attached media by position: @image1 for
// Seedance, <<<image_1>>> for Cinema Studio. Tag N is the Nth file of that
// kind in the order the request sends it.

export interface MentionAsset {
  kind: MediaKind;
  index: number;
  url: string;
  tag: string;
}

export interface MentionSegment {
  text: string;
  tag?: { valid: boolean };
}

const PATTERNS: Record<MentionSyntax["format"], RegExp> = {
  at: /@(image|video|audio)(\d+)\b/gi,
  angle: /<<<(image|video|audio)_(\d+)>>>/gi,
};

export function formatTag(format: MentionSyntax["format"], kind: MediaKind, index: number): string {
  return format === "at" ? `@${kind}${index}` : `<<<${kind}_${index}>>>`;
}

export function getMentionAssets(model: ModelSpec, media: MediaValues): MentionAsset[] {
  const syntax = model.mentions;
  if (!syntax) return [];
  return syntax.kinds.flatMap((kind) =>
    (media[`${kind}_urls`] ?? []).map((url, position) => ({
      kind,
      index: position + 1,
      url,
      tag: formatTag(syntax.format, kind, position + 1),
    })),
  );
}

/** Splits text into plain and tag segments; a tag is valid when it names an attached asset. */
export function tokenizeMentions(text: string, syntax: MentionSyntax, assets: MentionAsset[]): MentionSegment[] {
  const known = new Set(assets.map((asset) => asset.tag.toLowerCase()));
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(PATTERNS[syntax.format])) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start) });
    segments.push({ text: match[0], tag: { valid: known.has(match[0].toLowerCase()) } });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

export function findUnknownMentions(text: string, syntax: MentionSyntax, assets: MentionAsset[]): string[] {
  const unknown = tokenizeMentions(text, syntax, assets)
    .filter((segment) => segment.tag && !segment.tag.valid)
    .map((segment) => segment.text);
  return [...new Set(unknown)];
}

/** The `@query` being typed immediately before the caret, if any. */
export function findMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const match = text.slice(0, caret).match(/(^|\s)@([a-z]*\d*)$/i);
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2].toLowerCase() };
}

export function filterMentionAssets(assets: MentionAsset[], query: string): MentionAsset[] {
  if (!query) return assets;
  return assets.filter((asset) => `${asset.kind}${asset.index}`.startsWith(query));
}

/** Replaces text[start, end) with the tag and a trailing space; returns the new caret. */
export function insertMention(text: string, start: number, end: number, tag: string): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after.startsWith(" ") ? "" : " ";
  const next = `${before}${lead}${tag}${trail}${after}`;
  return { text: next, caret: before.length + lead.length + tag.length + 1 };
}
