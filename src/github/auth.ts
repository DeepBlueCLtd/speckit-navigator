/**
 * PAT get/set/clear + is-set helpers. PAT is stored only in localStorage on
 * this device; never logged, never interpolated into thrown errors.
 */

import type { Credential } from '../types';

const KEY = 'spec-navigator:github-pat';

let cached: Credential | null | undefined = undefined;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

/**
 * Subscribe to PAT changes (set/clear) within this tab. Returns an
 * unsubscribe function. Storage events across tabs are not proxied here —
 * if needed, a future callsite can bridge `window.addEventListener('storage', …)`
 * to `notify()`.
 */
export function subscribePat(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStorage(): Credential | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cached = null;
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { pat?: unknown }).pat === 'string' &&
      typeof (parsed as { savedAt?: unknown }).savedAt === 'string'
    ) {
      cached = parsed as Credential;
      return cached;
    }
    cached = null;
    return null;
  } catch {
    cached = null;
    return null;
  }
}

export function getPat(): string | null {
  const cred = readStorage();
  return cred ? cred.pat : null;
}

export function hasPat(): boolean {
  return getPat() !== null;
}

export function setPat(pat: string): void {
  if (!pat || pat.trim().length === 0) {
    throw new Error('PAT must not be empty');
  }
  const cred: Credential = { pat: pat.trim(), savedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(cred));
  cached = cred;
  notify();
}

export function clearPat(): void {
  localStorage.removeItem(KEY);
  cached = null;
  notify();
}

/**
 * Test-only: flush the in-memory cache so the next getPat() re-reads storage.
 * Production paths rely on set/clear maintaining the cache.
 */
export function _resetCacheForTests(): void {
  cached = undefined;
}
