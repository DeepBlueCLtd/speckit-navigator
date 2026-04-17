import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeature, pickFeatureFolder } from '../useFeature';
import { setPat, clearPat, _resetCacheForTests } from '../../github/auth';

const SHA = 'a'.repeat(40);

interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

function mockFetchByUrl(map: (url: string) => MockResponse | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const match = map(url);
      if (!match) {
        return new Response(JSON.stringify({ message: 'unmatched ' + url }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(match.body), {
        status: match.status,
        headers: { 'Content-Type': 'application/json', ...(match.headers ?? {}) },
      });
    }),
  );
}

describe('pickFeatureFolder', () => {
  it('returns the first specs/NNN-slug/ folder encountered', () => {
    const paths = [
      'docs/whatever.md',
      'specs/191-spec-navigator/spec.md',
      'specs/191-spec-navigator/plan.md',
    ];
    expect(pickFeatureFolder(paths)).toBe('specs/191-spec-navigator');
  });

  it('returns null when no feature folder is touched', () => {
    expect(pickFeatureFolder(['docs/a.md', 'README.md'])).toBeNull();
  });

  it('accepts 3+ digit issue numbers', () => {
    expect(pickFeatureFolder(['specs/12345-very-long/spec.md'])).toBe('specs/12345-very-long');
  });

  it('rejects invalid folder shapes', () => {
    expect(pickFeatureFolder(['specs/ab-no-number/spec.md'])).toBeNull();
    expect(pickFeatureFolder(['specs/12-too-short/spec.md'])).toBeNull();
  });
});

describe('useFeature', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCacheForTests();
    setPat('test-pat');
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    clearPat();
    vi.unstubAllGlobals();
  });

  it('surfaces notAuthenticated error when no PAT is configured', async () => {
    clearPat();
    _resetCacheForTests();
    const { result } = renderHook(() => useFeature(42));
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.error).toContain('Not authenticated');
  });

  it('re-fetches after setPat clears the notAuthenticated error', async () => {
    clearPat();
    _resetCacheForTests();
    mockFetchByUrl((url) => {
      if (url.endsWith('/pulls/42')) {
        return {
          status: 200,
          body: {
            number: 42,
            state: 'open',
            title: 't',
            head: { sha: SHA, ref: 'feat' },
          },
        };
      }
      if (url.includes('/pulls/42/files')) {
        return {
          status: 200,
          body: [
            { filename: 'specs/191-spec-navigator/spec.md', status: 'modified' },
          ],
        };
      }
      if (url.includes('/contents/specs/191-spec-navigator?ref=')) {
        return {
          status: 200,
          body: [
            {
              name: 'spec.md',
              path: 'specs/191-spec-navigator/spec.md',
              type: 'file',
              size: 100,
              download_url: 'https://raw.githubusercontent.com/x/y/z/spec.md',
            },
          ],
        };
      }
      return null;
    });
    const { result } = renderHook(() => useFeature(42));
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    // User saves a PAT — effect must re-run and clear the error.
    setPat('late-arrival-pat');
    await waitFor(() => {
      expect(result.current.scope).not.toBeNull();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.artefacts.length).toBe(1);
  });

  it('resolves scope + artefacts for a PR that touches a feature folder', async () => {
    mockFetchByUrl((url) => {
      if (url.endsWith('/pulls/42')) {
        return {
          status: 200,
          body: {
            number: 42,
            state: 'open',
            title: 't',
            head: { sha: SHA, ref: 'feat' },
          },
        };
      }
      if (url.includes('/pulls/42/files')) {
        return {
          status: 200,
          body: [
            { filename: 'docs/unrelated.md', status: 'modified' },
            { filename: 'specs/191-spec-navigator/spec.md', status: 'modified' },
            { filename: 'specs/191-spec-navigator/plan.md', status: 'added' },
          ],
        };
      }
      if (url.includes('/contents/specs/191-spec-navigator?ref=')) {
        return {
          status: 200,
          body: [
            {
              name: 'spec.md',
              path: 'specs/191-spec-navigator/spec.md',
              type: 'file',
              size: 1200,
              download_url: 'https://raw.githubusercontent.com/x/y/z/spec.md',
            },
            {
              name: 'plan.md',
              path: 'specs/191-spec-navigator/plan.md',
              type: 'file',
              size: 800,
              download_url: 'https://raw.githubusercontent.com/x/y/z/plan.md',
            },
          ],
        };
      }
      return null;
    });

    const { result } = renderHook(() => useFeature(42));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.scope).not.toBeNull();
    });
    expect(result.current.scope?.featureFolder).toBe('specs/191-spec-navigator');
    expect(result.current.scope?.headSha).toBe(SHA);
    expect(result.current.artefacts.length).toBe(2);
    const paths = result.current.artefacts.map((a) => a.path).sort();
    expect(paths).toEqual([
      'specs/191-spec-navigator/plan.md',
      'specs/191-spec-navigator/spec.md',
    ]);
  });

  it('surfaces no-feature-folder error when PR touches no specs/NNN folder', async () => {
    mockFetchByUrl((url) => {
      if (url.endsWith('/pulls/42')) {
        return {
          status: 200,
          body: {
            number: 42,
            state: 'open',
            title: 't',
            head: { sha: SHA, ref: 'feat' },
          },
        };
      }
      if (url.includes('/pulls/42/files')) {
        return {
          status: 200,
          body: [
            { filename: 'README.md', status: 'modified' },
            { filename: 'docs/other.md', status: 'modified' },
          ],
        };
      }
      return null;
    });

    const { result } = renderHook(() => useFeature(42));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.error).toContain('No feature folder');
    expect(result.current.scope).toBeNull();
  });

  it('surfaces pr-not-found error when GitHub returns 404', async () => {
    mockFetchByUrl(() => ({
      status: 404,
      body: { message: 'Not Found' },
    }));
    const { result } = renderHook(() => useFeature(42));
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.error).toContain('not found');
  });
});
