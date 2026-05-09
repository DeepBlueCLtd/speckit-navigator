import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INDEX_SOURCE = join(__dirname, '..', '..', 'index.html');
const INDEX_BUILT = join(__dirname, '..', '..', 'dist', 'index.html');

const EXPECTED_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'connect-src': ["'self'", 'https://api.github.com', 'https://raw.githubusercontent.com'],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'https://raw.githubusercontent.com', 'data:'],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],
};

function extractCsp(html: string): string | null {
  // CSP content contains single quotes (e.g. 'self'), so scope match to
  // double-quote delimiters, which the source file uses consistently.
  const match = html.match(
    /<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i,
  );
  return match ? match[1].trim() : null;
}

function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const directive of csp.split(';')) {
    const trimmed = directive.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const name = parts[0];
    out[name] = parts.slice(1);
  }
  return out;
}

describe('Content Security Policy', () => {
  it('index.html source carries the expected CSP meta tag', () => {
    const html = readFileSync(INDEX_SOURCE, 'utf8');
    const csp = extractCsp(html);
    expect(csp).not.toBeNull();

    const parsed = parseCsp(csp ?? '');
    for (const [name, expected] of Object.entries(EXPECTED_DIRECTIVES)) {
      expect(parsed[name], `missing directive ${name}`).toBeDefined();
      for (const token of expected) {
        expect(
          parsed[name].includes(token),
          `directive ${name} missing ${token}; got ${JSON.stringify(parsed[name])}`,
        ).toBe(true);
      }
    }
  });

  it.skipIf(!existsSync(INDEX_BUILT))('built dist/index.html preserves the CSP meta tag', () => {
    const html = readFileSync(INDEX_BUILT, 'utf8');
    const csp = extractCsp(html);
    expect(csp).not.toBeNull();
    const parsed = parseCsp(csp ?? '');
    for (const [name, expected] of Object.entries(EXPECTED_DIRECTIVES)) {
      expect(parsed[name]).toBeDefined();
      for (const token of expected) {
        expect(parsed[name].includes(token)).toBe(true);
      }
    }
  });
});
