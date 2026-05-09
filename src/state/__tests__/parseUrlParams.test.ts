import { describe, it, expect } from 'vitest';
import { parseUrlParams } from '../parseUrlParams';
import { DEFAULT_OWNER, DEFAULT_REPO } from '../../defaults';

describe('parseUrlParams', () => {
  it('returns defaults for an empty querystring', () => {
    const r = parseUrlParams('');
    expect(r.owner).toBe(DEFAULT_OWNER);
    expect(r.repo).toBe(DEFAULT_REPO);
    expect(r.branch).toBeNull();
    expect(r.prNumber).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it('parses ?repo=&branch= correctly', () => {
    const r = parseUrlParams('?repo=acme/foo&branch=feat/x');
    expect(r.owner).toBe('acme');
    expect(r.repo).toBe('foo');
    expect(r.branch).toBe('feat/x');
    expect(r.prNumber).toBeNull();
  });

  it('parses legacy ?pr= correctly', () => {
    const r = parseUrlParams('?pr=512');
    expect(r.prNumber).toBe(512);
    expect(r.owner).toBe(DEFAULT_OWNER);
    expect(r.repo).toBe(DEFAULT_REPO);
  });

  it('rejects malformed ?repo= and falls back to defaults', () => {
    const r = parseUrlParams('?repo=not-a-slug');
    expect(r.owner).toBe(DEFAULT_OWNER);
    expect(r.repo).toBe(DEFAULT_REPO);
    expect(r.warnings).toContain('Ignoring malformed ?repo= value: "not-a-slug".');
  });

  it('rejects malformed ?pr=', () => {
    const r = parseUrlParams('?pr=abc');
    expect(r.prNumber).toBeNull();
    expect(r.warnings).toContain('Ignoring malformed ?pr= value: "abc".');
  });

  it('rejects negative or zero ?pr=', () => {
    const r = parseUrlParams('?pr=0');
    expect(r.prNumber).toBeNull();
  });

  it('explicit ?repo= wins over ?pr= when both supplied', () => {
    const r = parseUrlParams('?repo=acme/foo&pr=512');
    expect(r.owner).toBe('acme');
    expect(r.repo).toBe('foo');
    expect(r.prNumber).toBeNull();
    expect(r.warnings.some((w) => w.includes('explicit form'))).toBe(true);
  });

  it('explicit ?branch= wins over ?pr= when both supplied', () => {
    const r = parseUrlParams('?branch=feat/x&pr=512');
    expect(r.branch).toBe('feat/x');
    expect(r.prNumber).toBeNull();
  });
});
