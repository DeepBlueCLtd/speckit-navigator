/**
 * Per-PR DraftCommentSet read/write with schemaVersion gating.
 * On version mismatch, quarantine into spec-navigator:quarantine:<timestamp>
 * and start fresh rather than silently discard.
 */

import type { DraftCommentSet } from '../types';

const PREFIX = 'spec-navigator:drafts:pr-';
const QUARANTINE_PREFIX = 'spec-navigator:quarantine:';

export class QuotaExceededError extends Error {
  constructor() {
    super('localStorage quota exceeded');
    this.name = 'QuotaExceededError';
  }
}

export function keyFor(prNumber: number): string {
  return `${PREFIX}${prNumber}`;
}

export function readDraftSet(prNumber: number): DraftCommentSet | null {
  try {
    const raw = localStorage.getItem(keyFor(prNumber));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraftSet(parsed)) {
      quarantine(raw);
      return null;
    }
    if (parsed.schemaVersion !== 1) {
      quarantine(raw);
      return null;
    }
    if (parsed.prNumber !== prNumber) {
      // Not ours — guard against accidental key collisions.
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraftSet(set: DraftCommentSet): void {
  try {
    localStorage.setItem(keyFor(set.prNumber), JSON.stringify(set));
  } catch (err) {
    if (isQuotaError(err)) {
      throw new QuotaExceededError();
    }
    throw err;
  }
}

export function clearDraftSet(prNumber: number): void {
  localStorage.removeItem(keyFor(prNumber));
}

function quarantine(raw: string): void {
  try {
    localStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
  } catch {
    // Silent — the quarantine is a best-effort safety net.
  }
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'QuotaExceededError') return true;
  // Firefox historically used NS_ERROR_DOM_QUOTA_REACHED.
  return /quota/i.test(err.message);
}

function isValidDraftSet(v: unknown): v is DraftCommentSet {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.schemaVersion === 'number' &&
    typeof o.prNumber === 'number' &&
    typeof o.featureFolder === 'string' &&
    typeof o.originalHeadSha === 'string' &&
    Array.isArray(o.comments) &&
    typeof o.lastModified === 'string'
  );
}
