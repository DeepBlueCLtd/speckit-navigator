import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ArtifactView } from '../ArtifactView';
import type { Artefact, FeatureScope } from '../../types';
import { setPat, clearPat, _resetCacheForTests } from '../../github/auth';
import { DEFAULT_OWNER, DEFAULT_REPO } from '../../defaults';

const SHA = 'a'.repeat(40);

const SCOPE: FeatureScope = {
  prNumber: 42,
  repoOwner: DEFAULT_OWNER,
  repoName: DEFAULT_REPO,
  headSha: SHA,
  featureFolder: 'specs/191-spec-navigator',
};

const SPEC_ARTEFACT: Artefact = {
  name: 'spec.md',
  path: 'specs/191-spec-navigator/spec.md',
  kind: 'spec',
  mimeType: 'text/markdown',
  size: 200,
  downloadUrl: null,
  content: null,
  fetchedAt: null,
};

const PLAN_ARTEFACT: Artefact = {
  name: 'plan.md',
  path: 'specs/191-spec-navigator/plan.md',
  kind: 'plan',
  mimeType: 'text/markdown',
  size: 200,
  downloadUrl: null,
  content: null,
  fetchedAt: null,
};

const JSON_ARTEFACT: Artefact = {
  name: 'schema.json',
  path: 'specs/191-spec-navigator/contracts/schema.json',
  kind: 'contract',
  mimeType: 'application/json',
  size: 40,
  downloadUrl: null,
  content: null,
  fetchedAt: null,
};

function mockResponses(map: (url: string) => { status: number; body: string; isBlob?: boolean } | null): {
  fetchCount: () => number;
} {
  let count = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      count += 1;
      const url = typeof input === 'string' ? input : input.toString();
      const m = map(url);
      if (!m) {
        return new Response('nope', { status: 404 });
      }
      if (m.isBlob) {
        return new Response(new Blob([m.body]), { status: m.status });
      }
      return new Response(m.body, { status: m.status });
    }),
  );
  return { fetchCount: () => count };
}

describe('ArtifactView', () => {
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

  it('fetches and renders markdown content as a rendered body', async () => {
    mockResponses((url) => {
      if (url.includes('spec.md')) {
        return { status: 200, body: '# Hello\n\nA **bold** claim.\n' };
      }
      return null;
    });
    render(
      <ArtifactView
        artefact={SPEC_ARTEFACT}
        scope={SCOPE}
        artefacts={[SPEC_ARTEFACT]}
        onAddDocumentComment={() => {}}
        onAddSelectionComment={() => {}}
        onCrossLinkNavigate={() => {}}
        commentAnchors={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('markdown-body')).not.toBeNull();
    });
    // Heading and bold text appear.
    const md = screen.getByTestId('markdown-body');
    expect(md.querySelector('h1')?.textContent).toContain('Hello');
    expect(md.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders JSON via the code-view path (not markdown)', async () => {
    mockResponses((url) => {
      if (url.includes('schema.json')) {
        return { status: 200, body: '{"a":1}' };
      }
      return null;
    });
    render(
      <ArtifactView
        artefact={JSON_ARTEFACT}
        scope={SCOPE}
        artefacts={[JSON_ARTEFACT]}
        onAddDocumentComment={() => {}}
        onAddSelectionComment={() => {}}
        onCrossLinkNavigate={() => {}}
        commentAnchors={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('code-body')).not.toBeNull();
    });
    expect(screen.queryByTestId('markdown-body')).toBeNull();
  });

  it('raw toggle swaps rendered markdown for pre-raw text without re-fetching', async () => {
    const { fetchCount } = mockResponses((url) => {
      if (url.includes('spec.md')) {
        return { status: 200, body: '# Title\n' };
      }
      return null;
    });
    render(
      <ArtifactView
        artefact={SPEC_ARTEFACT}
        scope={SCOPE}
        artefacts={[SPEC_ARTEFACT]}
        onAddDocumentComment={() => {}}
        onAddSelectionComment={() => {}}
        onCrossLinkNavigate={() => {}}
        commentAnchors={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('markdown-body')).not.toBeNull();
    });
    const before = fetchCount();
    fireEvent.click(screen.getByTestId('raw-toggle'));
    expect(screen.getByTestId('raw-body')).toBeTruthy();
    expect(screen.queryByTestId('markdown-body')).toBeNull();
    // No refetch on toggle.
    expect(fetchCount()).toBe(before);
    fireEvent.click(screen.getByTestId('raw-toggle'));
    expect(screen.queryByTestId('markdown-body')).not.toBeNull();
    expect(fetchCount()).toBe(before);
  });

  it('cross-link click intercepts navigation and calls onCrossLinkNavigate', async () => {
    mockResponses((url) => {
      if (url.includes('spec.md')) {
        return {
          status: 200,
          body: '# Spec\n\nSee [the plan](./plan.md) for details.\n',
        };
      }
      return null;
    });
    const onCrossLinkNavigate = vi.fn<(path: string) => void>();
    render(
      <ArtifactView
        artefact={SPEC_ARTEFACT}
        scope={SCOPE}
        artefacts={[SPEC_ARTEFACT, PLAN_ARTEFACT]}
        onAddDocumentComment={() => {}}
        onAddSelectionComment={() => {}}
        onCrossLinkNavigate={onCrossLinkNavigate}
        commentAnchors={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('markdown-body')).not.toBeNull();
    });
    const link = screen.getByText('the plan') as HTMLAnchorElement;
    fireEvent.click(link);
    expect(onCrossLinkNavigate).toHaveBeenCalledWith(
      'specs/191-spec-navigator/plan.md',
    );
  });

  it('surfaces an error banner when fetchRawText fails', async () => {
    mockResponses(() => ({ status: 500, body: 'server down' }));
    render(
      <ArtifactView
        artefact={SPEC_ARTEFACT}
        scope={SCOPE}
        artefacts={[SPEC_ARTEFACT]}
        onAddDocumentComment={() => {}}
        onAddSelectionComment={() => {}}
        onCrossLinkNavigate={() => {}}
        commentAnchors={[]}
      />,
    );
    await waitFor(() => {
      expect(document.querySelector('.error-banner')).not.toBeNull();
    });
  });
});
