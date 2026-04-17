import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpecBrowserModal } from '../SpecBrowserModal';
import { setPat, clearPat, _resetCacheForTests } from '../../github/auth';

describe('SpecBrowserModal', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCacheForTests();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    clearPat();
    vi.unstubAllGlobals();
  });

  it('shows the auth-required message when no PAT is set', () => {
    render(<SpecBrowserModal onClose={() => {}} />);
    expect(screen.getByText(/GitHub token is required/)).toBeTruthy();
  });

  it('renders the OpenPrList when a PAT is configured', async () => {
    setPat('test-pat');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([{ number: 10, title: 'Example', head: { ref: 'feat/ex' } }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    render(<SpecBrowserModal onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('open-pr-link-10')).toBeTruthy();
    });
  });

  it('Close button invokes onClose', () => {
    const onClose = vi.fn();
    render(<SpecBrowserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('spec-browser-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape key invokes onClose', () => {
    const onClose = vi.fn();
    render(<SpecBrowserModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
