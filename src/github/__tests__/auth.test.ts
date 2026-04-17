import { describe, it, expect, beforeEach } from 'vitest';
import { getPat, setPat, clearPat, hasPat, _resetCacheForTests } from '../auth';

describe('auth PAT storage', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCacheForTests();
  });

  it('round-trips a PAT through set/get', () => {
    expect(hasPat()).toBe(false);
    setPat('test-pat-value');
    expect(hasPat()).toBe(true);
    expect(getPat()).toBe('test-pat-value');
  });

  it('clear wipes both storage and in-memory cache', () => {
    setPat('sensitive-pat');
    clearPat();
    expect(hasPat()).toBe(false);
    expect(getPat()).toBeNull();
    expect(localStorage.getItem('spec-navigator:github-pat')).toBeNull();
  });

  it('rejects empty PATs', () => {
    expect(() => setPat('')).toThrow();
    expect(() => setPat('   ')).toThrow();
  });

  it('survives localStorage corruption', () => {
    localStorage.setItem('spec-navigator:github-pat', 'not-json{');
    _resetCacheForTests();
    expect(hasPat()).toBe(false);
    expect(getPat()).toBeNull();
  });

  it('set/clear errors do not include the PAT in their message', () => {
    try {
      setPat('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain('pat-that-should-not-leak');
    }
  });
});
