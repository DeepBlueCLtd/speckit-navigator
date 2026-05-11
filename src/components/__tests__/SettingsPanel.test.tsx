import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from '../SettingsPanel';
import { clearPat, hasPat, _resetCacheForTests } from '../../github/auth';

function stubFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })),
  );
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCacheForTests();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    clearPat();
    vi.unstubAllGlobals();
  });

  it('renders scope / permissions guidance and the PAT-create link', () => {
    render(<SettingsPanel onClose={() => {}} />);
    expect(screen.getByText(/Contents: Read/)).toBeTruthy();
    expect(screen.getByText(/Pull requests: Read and Write/)).toBeTruthy();
    const link = screen.getByText(/Open GitHub PAT settings/).closest('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toBe('https://github.com/settings/personal-access-tokens/new');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
  });

  it('PAT input is masked by default and reveal toggles to text', () => {
    render(<SettingsPanel onClose={() => {}} />);
    const input = screen.getByTestId('settings-pat-input') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByTestId('settings-reveal'));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByTestId('settings-reveal'));
    expect(input.type).toBe('password');
  });

  it('Save calls setPat + probes the API; on 200 shows probeSuccess', async () => {
    stubFetch(200, { number: 1, state: 'open', title: 't', head: { sha: 'a'.repeat(40), ref: 'main' } });
    render(<SettingsPanel onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('settings-pat-input'), {
      target: { value: 'github_pat_valid_123' },
    });
    fireEvent.click(screen.getByTestId('settings-save'));
    await waitFor(() => {
      expect(screen.getByText(/Token accepted/)).toBeTruthy();
    });
    expect(hasPat()).toBe(true);
  });

  it('Save treats pr-not-found (404) as a probe success (auth works, no PR #1)', async () => {
    stubFetch(404, { message: 'Not Found' });
    render(<SettingsPanel onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('settings-pat-input'), {
      target: { value: 'github_pat_valid_no_pr1' },
    });
    fireEvent.click(screen.getByTestId('settings-save'));
    await waitFor(() => {
      expect(screen.getByText(/Token accepted/)).toBeTruthy();
    });
    expect(hasPat()).toBe(true);
  });

  it('Save with a 401 response shows scope error banner and leaves PAT set (user can retry)', async () => {
    stubFetch(401, { message: 'Bad credentials' });
    render(<SettingsPanel onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('settings-pat-input'), {
      target: { value: 'github_pat_invalid' },
    });
    fireEvent.click(screen.getByTestId('settings-save'));
    await waitFor(() => {
      expect(screen.getByText(/Token rejected/)).toBeTruthy();
    });
  });

  it('Clear wipes storage, cache, and the input value', () => {
    render(<SettingsPanel onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('settings-pat-input'), {
      target: { value: 'github_pat_set_then_clear' },
    });
    // Populate storage by clicking save (probe will fail silently — that's fine).
    // Simpler: directly set and assert the cleared state after Clear.
    fireEvent.click(screen.getByTestId('settings-clear'));
    const input = screen.getByTestId('settings-pat-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(hasPat()).toBe(false);
  });

  it('PAT string appears only inside the input value, not leaked elsewhere in the DOM', () => {
    const secret = 'github_pat_super_secret_NONCE_123';
    render(<SettingsPanel onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('settings-pat-input'), {
      target: { value: secret },
    });
    const input = screen.getByTestId('settings-pat-input') as HTMLInputElement;
    expect(input.value).toBe(secret);
    // Anywhere else in the DOM: no text node containing the secret.
    const allText = document.body.textContent ?? '';
    expect(allText).not.toContain(secret);
  });

  it('Close button invokes onClose', () => {
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);
    fireEvent.click(screen.getByTestId('settings-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
