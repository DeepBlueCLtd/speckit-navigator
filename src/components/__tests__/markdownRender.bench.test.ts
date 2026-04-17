/**
 * Markdown render soft-gate benchmark (T078).
 *
 * Renders 50/150/300 KB of real markdown through <MarkdownView /> (SSR
 * via renderToStaticMarkup — exercises remark-gfm + rehype-slug +
 * rehype-autolink-headings + rehype-highlight). Soft-gates each run at
 * 1000 ms. The measured duration is logged to stdout so CI evidence
 * capture (T100) can snapshot it.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MarkdownView } from '../MarkdownView';
import type { FeatureScope } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCOPE: FeatureScope = {
  prNumber: 1,
  repoOwner: 'debrief',
  repoName: 'debrief-future',
  headSha: '0'.repeat(40),
  featureFolder: 'specs/191-spec-navigator',
};

const SOFT_GATE_MS = 1000;

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

function renderOnce(md: string): number {
  const start = performance.now();
  renderToStaticMarkup(
    createElement(MarkdownView, {
      content: md,
      artefactPath: 'specs/191-spec-navigator/spec.md',
      scope: SCOPE,
      artefacts: [],
    }),
  );
  return performance.now() - start;
}

describe('markdown render soft-gate', () => {
  const cases: Array<{ file: string; label: string; sizeKb: number }> = [
    { file: '50kb.md', label: '50KB', sizeKb: 50 },
    { file: '150kb.md', label: '150KB', sizeKb: 150 },
    { file: '300kb.md', label: '300KB', sizeKb: 300 },
  ];

  for (const c of cases) {
    it(`renders ${c.label} markdown under ${SOFT_GATE_MS}ms`, () => {
      const md = loadFixture(c.file);
      expect(md.length).toBeGreaterThanOrEqual(c.sizeKb * 1024 - 100);
      // Warm the JIT to reduce first-run noise.
      renderOnce(md);
      const durations: number[] = [];
      for (let i = 0; i < 3; i++) {
        durations.push(renderOnce(md));
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      // eslint-disable-next-line no-console
      console.log(`markdown-bench ${c.label}: avg=${avg.toFixed(1)}ms (${durations.map((d) => d.toFixed(0)).join(', ')})`);
      expect(avg).toBeLessThan(SOFT_GATE_MS);
    });
  }
});
