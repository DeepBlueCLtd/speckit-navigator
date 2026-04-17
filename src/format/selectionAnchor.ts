/**
 * Selection anchor helper.
 * Produces `{ snippet, contextBefore, contextAfter, anchorHash }` for a
 * selection captured in the raw source of an artefact.
 *
 * Anchor format (pinned, per research.md §2):
 *   <first20-of-snippet>\x1F<last20-of-snippet>\x1F<charOffset>
 * \x1F is ASCII US (unit separator, code point 0x1F) — cannot appear in
 * source markdown, so round-tripping is unambiguous.
 */

import type { SelectionContext } from '../types';

const US = '\u001F';
const CONTEXT_TARGET = 60;
const CONTEXT_MAX = 200;

export function captureSelection(
  source: string,
  start: number,
  end: number,
): SelectionContext {
  if (start < 0 || end > source.length || end <= start) {
    throw new Error('captureSelection: invalid range');
  }
  const snippet = source.slice(start, end);
  const contextBefore = extractContext(source.slice(0, start), 'before');
  const contextAfter = extractContext(source.slice(end), 'after');
  const first = snippet.slice(0, 20);
  const last = snippet.slice(Math.max(0, snippet.length - 20));
  const anchorHash = `${first}${US}${last}${US}${start}`;
  return { snippet, contextBefore, contextAfter, anchorHash };
}

function extractContext(text: string, side: 'before' | 'after'): string {
  if (side === 'before') {
    if (text.length === 0) return '';
    let slice = text.slice(Math.max(0, text.length - CONTEXT_MAX));
    if (slice.length <= CONTEXT_TARGET) return slice;
    slice = slice.slice(slice.length - CONTEXT_TARGET);
    const boundary = slice.search(/\s/);
    if (boundary > 0 && boundary < slice.length - 1) {
      slice = slice.slice(boundary + 1);
    }
    return slice;
  }
  if (text.length === 0) return '';
  let slice = text.slice(0, Math.min(text.length, CONTEXT_MAX));
  if (slice.length <= CONTEXT_TARGET) return slice;
  slice = slice.slice(0, CONTEXT_TARGET);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) slice = slice.slice(0, lastSpace);
  return slice;
}

/**
 * Best-effort re-locator for a stored anchor against possibly-edited source.
 * Returns the new start offset, or null if no confident match.
 * Exported for future use by the PR watcher; v1 UI only needs captureSelection.
 */
export function resolveAnchor(source: string, anchorHash: string): number | null {
  const parts = anchorHash.split(US);
  if (parts.length !== 3) return null;
  const [first, last, offsetStr] = parts as [string, string, string];
  const originalOffset = Number.parseInt(offsetStr, 10);
  // Prefer exact offset if both prefix and suffix still match there.
  if (
    Number.isFinite(originalOffset) &&
    source.startsWith(first, originalOffset)
  ) {
    const potentialEnd = originalOffset + Math.max(first.length, last.length);
    if (potentialEnd <= source.length) {
      return originalOffset;
    }
  }
  const idx = source.indexOf(first);
  if (idx < 0) return null;
  if (last.length === 0 || first === last) return idx;
  // Scan forward for the nearest `last` occurrence after `first`.
  const afterFirst = idx + first.length;
  const suffixIdx = source.indexOf(last, afterFirst);
  if (suffixIdx < 0) return null;
  return idx;
}
