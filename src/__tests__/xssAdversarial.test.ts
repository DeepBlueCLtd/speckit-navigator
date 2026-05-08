import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MarkdownView } from '../components/MarkdownView';
import type { FeatureScope } from '../types';
import { DEFAULT_OWNER, DEFAULT_REPO } from '../defaults';

const SCOPE: FeatureScope = {
  prNumber: 1,
  repoOwner: DEFAULT_OWNER,
  repoName: DEFAULT_REPO,
  headSha: '0'.repeat(40),
  featureFolder: 'specs/191-spec-navigator',
};

/**
 * 10 standard XSS payloads attempted via markdown input. react-markdown
 * is safe-by-default (no raw HTML, URL schemes sanitised) — we assert
 * the rendered output contains no <script>, no on*-handler attributes,
 * and no javascript:/data:text/html href or src attributes.
 */
const PAYLOADS: string[] = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '[click](javascript:alert(1))',
  '[click](JaVaScRiPt:alert(1))',
  '![img](javascript:alert(1))',
  '[click](data:text/html,<script>alert(1)</script>)',
  '<a href="javascript:alert(1)">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<body onload=alert(1)>hello</body>',
];

function renderDom(content: string): HTMLDivElement {
  const html = renderToStaticMarkup(
    createElement(MarkdownView, {
      content,
      artefactPath: 'specs/191-spec-navigator/spec.md',
      scope: SCOPE,
      artefacts: [],
    }),
  );
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('XSS adversarial fuzz', () => {
  for (const payload of PAYLOADS) {
    it(`defends against: ${payload.slice(0, 40)}`, () => {
      const dom = renderDom(payload);
      expect(dom.querySelectorAll('script').length).toBe(0);
      expect(dom.querySelectorAll('iframe').length).toBe(0);
      expect(dom.querySelectorAll('object').length).toBe(0);
      expect(dom.querySelectorAll('embed').length).toBe(0);

      // No element should carry an on*-event-handler attribute.
      const all = dom.querySelectorAll('*');
      for (const el of Array.from(all)) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name).not.toMatch(/^on/i);
        }
      }

      // No href/src pointing at javascript: or data:text/html.
      const linkLikes = dom.querySelectorAll('[href], [src]');
      for (const el of Array.from(linkLikes)) {
        const href = el.getAttribute('href') ?? '';
        const src = el.getAttribute('src') ?? '';
        for (const url of [href, src]) {
          expect(url).not.toMatch(/^\s*javascript:/i);
          expect(url).not.toMatch(/^\s*data:text\/html/i);
        }
      }
    });
  }
});
