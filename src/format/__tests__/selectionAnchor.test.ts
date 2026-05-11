import { describe, it, expect } from 'vitest';
import { captureSelection, resolveAnchor } from '../selectionAnchor';

const US = '\u001F';

describe('captureSelection', () => {
  it('captures snippet + context + anchorHash for a middle-of-text selection', () => {
    const source = 'The quick brown fox jumps over the lazy dog and runs home.';
    const start = source.indexOf('brown fox');
    const end = start + 'brown fox'.length;
    const cap = captureSelection(source, start, end);
    expect(cap.snippet).toBe('brown fox');
    expect(cap.contextBefore.length).toBeGreaterThan(0);
    expect(cap.contextAfter.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-control-regex
    expect(cap.anchorHash).toMatch(/^.+\u001F.+\u001F\d+$/);
    const parts = cap.anchorHash.split(US);
    expect(parts[0]).toBe('brown fox'.slice(0, 20));
    expect(parts[1]).toBe('brown fox'.slice(-20));
    expect(parts[2]).toBe(String(start));
  });

  it('start-of-file selection has empty contextBefore', () => {
    const source = 'Beginning of the document.';
    const cap = captureSelection(source, 0, 'Beginning'.length);
    expect(cap.contextBefore).toBe('');
    expect(cap.snippet).toBe('Beginning');
    expect(cap.contextAfter.length).toBeGreaterThan(0);
  });

  it('end-of-file selection has empty contextAfter', () => {
    const source = 'Everything ends with THIS';
    const cap = captureSelection(source, source.length - 4, source.length);
    expect(cap.snippet).toBe('THIS');
    expect(cap.contextAfter).toBe('');
  });

  it('rejects invalid ranges', () => {
    expect(() => captureSelection('abc', 2, 1)).toThrow();
    expect(() => captureSelection('abc', -1, 1)).toThrow();
    expect(() => captureSelection('abc', 0, 99)).toThrow();
  });

  it('resolves an anchor against unmodified source at the original offset', () => {
    const source = 'alpha beta gamma delta epsilon zeta';
    const start = source.indexOf('gamma');
    const cap = captureSelection(source, start, start + 'gamma'.length);
    const resolved = resolveAnchor(source, cap.anchorHash);
    expect(resolved).toBe(start);
  });

  it('resolves an anchor against slightly edited source by prefix search', () => {
    const source = 'PREAMBLE alpha beta gamma delta';
    const start = source.indexOf('gamma');
    const cap = captureSelection(source, start, start + 'gamma'.length);
    const edited = 'NEW PREAMBLE alpha beta gamma delta';
    const resolved = resolveAnchor(edited, cap.anchorHash);
    expect(resolved).toBe(edited.indexOf('gamma'));
  });

  it('resolveAnchor returns null for a completely absent passage', () => {
    const source = 'now for something completely different';
    expect(resolveAnchor(source, 'nowhere' + US + 'nowhere' + US + '0')).toBeNull();
  });
});
