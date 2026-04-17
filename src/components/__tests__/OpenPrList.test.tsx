import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OpenPrList } from '../OpenPrList';
import { setPat, clearPat, _resetCacheForTests } from '../../github/auth';

function mockOpenPrs(prs: Array<{ number: number; title: string; ref: string }>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify(
          prs.map((p) => ({
            number: p.number,
            title: p.title,
            head: { ref: p.ref },
          })),
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );
}

describe('OpenPrList', () => {
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

  it('shows a loading state then lists the returned PRs', async () => {
    mockOpenPrs([
      { number: 456, title: 'Fix drawer layout', ref: 'fix/drawer-steals-space' },
      { number: 454, title: 'Another PR', ref: 'fix/other' },
    ]);
    render(<OpenPrList />);
    await waitFor(() => {
      expect(screen.getByTestId('open-pr-list-items')).toBeTruthy();
    });
    const link456 = screen.getByTestId('open-pr-link-456') as HTMLAnchorElement;
    expect(link456.getAttribute('href')).toBe('?pr=456');
    expect(link456.textContent).toContain('#456');
    expect(link456.textContent).toContain('Fix drawer layout');
    expect(link456.textContent).toContain('fix/drawer-steals-space');
  });

  it('renders empty-state copy when there are zero open PRs', async () => {
    mockOpenPrs([]);
    render(<OpenPrList />);
    await waitFor(() => {
      expect(screen.getByText(/No open pull requests/)).toBeTruthy();
    });
  });

  it('surfaces an error banner when the list fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'rate limit' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '0' },
        }),
      ),
    );
    render(<OpenPrList />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('re-fetches when the PAT changes (subscribePat hook)', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        return new Response(
          JSON.stringify(
            call === 1
              ? [{ number: 1, title: 'first', head: { ref: 'a' } }]
              : [{ number: 2, title: 'second', head: { ref: 'b' } }],
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
    render(<OpenPrList />);
    await waitFor(() => {
      expect(screen.getByTestId('open-pr-link-1')).toBeTruthy();
    });
    setPat('a-different-pat');
    await waitFor(() => {
      expect(screen.getByTestId('open-pr-link-2')).toBeTruthy();
    });
  });
});
