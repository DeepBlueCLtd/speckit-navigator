import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchPullRequest,
  fetchChangedFiles,
  fetchContentsListing,
  fetchOpenPullRequests,
  fetchRawText,
  createIssueComment,
  ApiError,
} from '../api';
import { setPat, clearPat, _resetCacheForTests } from '../auth';

const SECRET_PAT = 'github_pat_secret_leak_probe_XXYY';

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

describe('github/api error mapping (T084)', () => {
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

  it('401 → credential-rejected', async () => {
    stubFetchOnce(401, { message: 'Bad credentials' });
    await expect(fetchPullRequest(42)).rejects.toMatchObject({
      kind: 'credential-rejected',
    });
  });

  it('403 with rate-limit-0 → rate-limit', async () => {
    stubFetchOnce(403, { message: 'API rate limit exceeded' }, {
      'X-RateLimit-Remaining': '0',
    });
    await expect(fetchPullRequest(42)).rejects.toMatchObject({ kind: 'rate-limit' });
  });

  it('403 without rate-limit-0 → credential-rejected', async () => {
    stubFetchOnce(403, { message: 'Forbidden' });
    await expect(fetchPullRequest(42)).rejects.toMatchObject({
      kind: 'credential-rejected',
    });
  });

  it('404 → pr-not-found', async () => {
    stubFetchOnce(404, { message: 'Not Found' });
    await expect(fetchPullRequest(42)).rejects.toMatchObject({ kind: 'pr-not-found' });
  });

  it('422 → server-validation', async () => {
    stubFetchOnce(422, { message: 'Validation Failed' });
    await expect(createIssueComment(42, 'body')).rejects.toMatchObject({
      kind: 'server-validation',
    });
  });

  it('429 → rate-limit', async () => {
    stubFetchOnce(429, { message: 'Too Many Requests' });
    await expect(fetchChangedFiles(42)).rejects.toMatchObject({ kind: 'rate-limit' });
  });

  it('500 → unknown', async () => {
    stubFetchOnce(500, { message: 'Server Error' });
    await expect(fetchPullRequest(42)).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('network failure → network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
    );
    await expect(fetchPullRequest(42)).rejects.toMatchObject({ kind: 'network' });
  });

  it('reads are allowed unauthenticated (no Authorization header) and proceed on 200', async () => {
    clearPat();
    _resetCacheForTests();
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          number: 42,
          state: 'open',
          title: 't',
          head: { sha: 'a'.repeat(40), ref: 'feat' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', spy);
    const pr = await fetchPullRequest(42);
    expect(pr.number).toBe(42);
    const [, init] = spy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });

  it('createIssueComment still rejects with credential-missing when no PAT is configured', async () => {
    clearPat();
    _resetCacheForTests();
    await expect(createIssueComment(42, 'body')).rejects.toMatchObject({
      kind: 'credential-missing',
    });
  });

  it('does NOT leak the PAT in any ApiError message across status codes', async () => {
    for (const status of [401, 403, 404, 422, 429, 500]) {
      stubFetchOnce(status, { message: `status=${status} — PAT should not be echoed` });
      try {
        await fetchPullRequest(42);
        throw new Error('expected rejection');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const msg = (e as ApiError).message;
        expect(msg).not.toContain(SECRET_PAT);
      }
    }
  });

  it('zod narrowing rejects malformed PR payloads with kind=unknown', async () => {
    stubFetchOnce(200, { number: 42, state: 'open', title: 't' /* no head */ });
    await expect(fetchPullRequest(42)).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('zod narrowing rejects a PR whose head.sha is not a SHA-1', async () => {
    stubFetchOnce(200, {
      number: 42,
      state: 'open',
      title: 't',
      head: { sha: 'not-a-real-sha', ref: 'feat' },
    });
    await expect(fetchPullRequest(42)).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('fetchContentsListing propagates 404 as pr-not-found', async () => {
    stubFetchOnce(404, { message: 'Not Found' });
    await expect(
      fetchContentsListing('specs/191-spec-navigator', 'a'.repeat(40)),
    ).rejects.toMatchObject({ kind: 'pr-not-found' });
  });

  it('fetchOpenPullRequests hits the open-state list endpoint and narrows the payload', async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            number: 100,
            title: 'First PR',
            state: 'open',
            head: { ref: 'feat/a', sha: 'a'.repeat(40) },
            body: 'ignored',
          },
          {
            number: 101,
            title: 'Second PR',
            state: 'open',
            head: { ref: 'feat/b', sha: 'b'.repeat(40) },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', spy);
    const list = await fetchOpenPullRequests();
    expect(list.length).toBe(2);
    expect(list[0].number).toBe(100);
    expect(list[0].head.ref).toBe('feat/a');
    const [url] = spy.mock.calls[0];
    expect(String(url)).toContain('/pulls?state=open');
    expect(String(url)).toContain('per_page=100');
  });

  it('fetchRawText does NOT send Authorization to raw.githubusercontent.com', async () => {
    // raw.githubusercontent.com rejects the CORS preflight when the
    // request carries an Authorization header. Public repos resolve
    // without it; private-repo support is via the Contents API instead.
    const spy = vi.fn(async () => new Response('hello', { status: 200 }));
    vi.stubGlobal('fetch', spy);
    const text = await fetchRawText('specs/191-spec-navigator/spec.md', 'a'.repeat(40));
    expect(text).toBe('hello');
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('raw.githubusercontent.com');
    const headers = init?.headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
    // The PAT must not appear in any header value either.
    for (const [, value] of headers.entries()) {
      expect(value).not.toContain(SECRET_PAT);
    }
  });
});
