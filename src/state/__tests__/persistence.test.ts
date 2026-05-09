import { describe, it, expect, beforeEach } from 'vitest';
import { readDraftSet, writeDraftSet, clearDraftSet, keyFor, QuotaExceededError } from '../persistence';
import type { DraftCommentSet } from '../../types';

function makeSet(prNumber: number, body = 'hi'): DraftCommentSet {
  return {
    schemaVersion: 1,
    prNumber,
    featureFolder: 'specs/191-spec-navigator',
    originalHeadSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    comments: [
      { id: 'comment-a-long-id', level: 'feature', body },
    ],
    lastModified: '2026-04-17T00:00:00Z',
  };
}

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes and reads a DraftCommentSet round-trip', () => {
    const set = makeSet(42);
    writeDraftSet(set);
    const out = readDraftSet(42);
    expect(out).toEqual(set);
  });

  it('returns null when no draft exists for a PR', () => {
    expect(readDraftSet(99)).toBeNull();
  });

  it('per-PR isolation: drafts for PR A are absent when reading PR B', () => {
    writeDraftSet(makeSet(1, 'for-pr-1'));
    writeDraftSet(makeSet(2, 'for-pr-2'));
    expect(readDraftSet(1)?.comments[0]?.body).toBe('for-pr-1');
    expect(readDraftSet(2)?.comments[0]?.body).toBe('for-pr-2');
  });

  it('clearDraftSet removes the key', () => {
    writeDraftSet(makeSet(42));
    clearDraftSet(42);
    expect(readDraftSet(42)).toBeNull();
    expect(localStorage.getItem(keyFor(42))).toBeNull();
  });

  it('version mismatch quarantines the payload and returns null', () => {
    const bad = { ...makeSet(42), schemaVersion: 2 };
    localStorage.setItem(keyFor(42), JSON.stringify(bad));
    expect(readDraftSet(42)).toBeNull();
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith('spec-navigator:quarantine:'),
    );
    expect(keys.length).toBe(1);
  });

  it('full draft lifecycle: write → reload → edit → reload → clear (T069)', () => {
    // 1. Fresh draft set for PR 42.
    writeDraftSet(makeSet(42, 'first-body'));

    // 2. Reload: the set is present with the original body.
    let loaded = readDraftSet(42);
    expect(loaded?.comments.length).toBe(1);
    expect(loaded?.comments[0]?.body).toBe('first-body');

    // 3. Edit: mutate the set in place and write back.
    const edited: DraftCommentSet = {
      ...loaded!,
      comments: [{ ...loaded!.comments[0]!, body: 'second-body' }],
      lastModified: '2026-04-17T01:00:00Z',
    };
    writeDraftSet(edited);

    // 4. Reload: the edited body is what comes back.
    loaded = readDraftSet(42);
    expect(loaded?.comments[0]?.body).toBe('second-body');
    expect(loaded?.lastModified).toBe('2026-04-17T01:00:00Z');

    // 5. Clear: the set is gone and the storage key is removed.
    clearDraftSet(42);
    expect(readDraftSet(42)).toBeNull();
    expect(localStorage.getItem(keyFor(42))).toBeNull();
  });

  it('raises QuotaExceededError when storage is full', () => {
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    const original = proto.setItem;
    const err = new Error('QuotaExceededError: out of space');
    err.name = 'QuotaExceededError';
    proto.setItem = function (): void {
      throw err;
    };
    try {
      expect(() => writeDraftSet(makeSet(42))).toThrow(QuotaExceededError);
    } finally {
      proto.setItem = original;
    }
  });
});
