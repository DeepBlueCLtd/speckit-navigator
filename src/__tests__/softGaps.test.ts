/**
 * Soft-gap behaviour (T086) — error surfaces the app must degrade
 * gracefully under rather than crash or leak.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFeature } from '../state/useFeature';
import { commentsReducer, initialCommentsState } from '../state/commentsReducer';
import { QuotaExceededError, writeDraftSet, readDraftSet, keyFor } from '../state/persistence';
import { fetchPullRequest, createIssueComment } from '../github/api';
import { setPat, clearPat, _resetCacheForTests } from '../github/auth';
import type { DraftCommentSet } from '../types';

const SECRET_PAT = 'github_pat_softgap_secret_YY';
const SHA = 'a'.repeat(40);

function stubFetchOnce(status: number, body: unknown, headers: Record<string, string> = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
      }),
    ),
  );
}

describe('soft-gap surfaces', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCacheForTests();
    setPat(SECRET_PAT);
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    clearPat();
    vi.unstubAllGlobals();
  });

  it('useFeature surfaces no-feature-folder when the PR touches no specs/NNN-* path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/pulls/42/files')) {
          return new Response(
            JSON.stringify([{ filename: 'README.md', status: 'modified' }]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ number: 42, state: 'open', title: 't', head: { sha: SHA, ref: 'main' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
    const { result } = renderHook(() => useFeature(42));
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.error?.kind).toBe('no-feature-folder');
    expect(result.current.error?.message).toContain('No feature folder');
  });

  it('QuotaExceededError from persistence does not leave memory state corrupted', () => {
    // Write one set successfully.
    const set: DraftCommentSet = {
      schemaVersion: 1,
      prNumber: 42,
      featureFolder: 'specs/191-spec-navigator',
      originalHeadSha: SHA,
      comments: [{ id: 'a-long-id-12', level: 'feature', body: 'first' }],
      lastModified: '2026-04-17T00:00:00Z',
    };
    writeDraftSet(set);

    // Now simulate quota exhaustion on the next write.
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    const original = proto.setItem;
    const err = new Error('quota');
    err.name = 'QuotaExceededError';
    proto.setItem = function (): void {
      throw err;
    };
    try {
      expect(() => {
        writeDraftSet({ ...set, comments: [...set.comments, { id: 'b-long-id-34', level: 'feature', body: 'second' }] });
      }).toThrow(QuotaExceededError);
    } finally {
      proto.setItem = original;
    }

    // The already-committed entry is still readable.
    const reloaded = readDraftSet(42);
    expect(reloaded?.comments[0]?.body).toBe('first');
    expect(localStorage.getItem(keyFor(42))).not.toBeNull();
  });

  it('422 server-validation error surfaces without leaking the PAT string', async () => {
    stubFetchOnce(422, { message: 'Validation Failed' });
    try {
      await createIssueComment(42, 'body');
      throw new Error('expected rejection');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain(SECRET_PAT);
    }
  });

  it('network failure surfaces as a "network" kind without crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('NetworkError when attempting to fetch resource.');
      }),
    );
    await expect(fetchPullRequest(42)).rejects.toMatchObject({ kind: 'network' });
  });

  it('commentsReducer rejects a body over MAX_BODY without mutating state', () => {
    const state = initialCommentsState(42, 'specs/191-spec-navigator', SHA);
    const tooLong = 'x'.repeat(10001);
    const next = commentsReducer(state, {
      type: 'ADD_COMMENT',
      draft: { level: 'feature', body: tooLong },
    });
    expect(next.comments.length).toBe(0);
    expect(next.lastError?.message).toMatch(/too long/i);
  });

  it('commentsReducer rejects the 101st comment without mutating the preceding 100', () => {
    let state = initialCommentsState(42, 'specs/191-spec-navigator', SHA);
    for (let i = 0; i < 100; i++) {
      state = commentsReducer(state, {
        type: 'ADD_COMMENT',
        draft: { level: 'feature', body: `item ${i}` },
      });
    }
    expect(state.comments.length).toBe(100);
    const next = commentsReducer(state, {
      type: 'ADD_COMMENT',
      draft: { level: 'feature', body: 'overflow' },
    });
    expect(next.comments.length).toBe(100);
    expect(next.lastError?.message).toMatch(/Too many drafts/);
  });

  it('useFeature abort-on-unmount does not throw an unhandled rejection', async () => {
    let resolveFetch: (v: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((res) => {
            resolveFetch = res;
          }),
      ),
    );
    const { unmount } = renderHook(() => useFeature(42));
    // Unmount before fetch resolves.
    act(() => {
      unmount();
    });
    // Now resolve — must not throw.
    resolveFetch(
      new Response(
        JSON.stringify({ number: 42, state: 'open', title: 't', head: { sha: SHA, ref: 'main' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    // No assertion needed beyond "no unhandled rejection surfaces here".
    await new Promise((r) => setTimeout(r, 10));
    expect(true).toBe(true);
  });
});
