import { describe, it, expect } from 'vitest';
import {
  PullRequestSchema,
  ContentsListingSchema,
  IssueCommentCreateResponseSchema,
} from '../schemas';
import { DEFAULT_OWNER, DEFAULT_REPO } from '../../defaults';

const REPO_PATH = `${DEFAULT_OWNER}/${DEFAULT_REPO}`;

describe('PullRequestSchema', () => {
  it('accepts a realistic open pull request payload', () => {
    const result = PullRequestSchema.safeParse({
      number: 42,
      state: 'open',
      title: 'Sample',
      head: {
        sha: 'f3a2b1c4d5e6f7081920aabbccddeeff00112233',
        ref: 'feature-branch',
      },
      extra_field: 'ignored-but-passes-through',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload with a non-hex head.sha', () => {
    const result = PullRequestSchema.safeParse({
      number: 1,
      state: 'open',
      title: 'x',
      head: { sha: 'not-a-sha', ref: 'main' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing required fields', () => {
    const result = PullRequestSchema.safeParse({ number: 1 });
    expect(result.success).toBe(false);
  });
});

describe('ContentsListingSchema', () => {
  it('accepts a directory listing', () => {
    const result = ContentsListingSchema.safeParse([
      {
        name: 'spec.md',
        path: 'specs/191-spec-navigator/spec.md',
        type: 'file',
        size: 1234,
        download_url: `https://raw.githubusercontent.com/${REPO_PATH}/abc/spec.md`,
      },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects entries with unknown type', () => {
    const result = ContentsListingSchema.safeParse([
      { name: 'x', path: 'p', type: 'wormhole', size: 0, download_url: null },
    ]);
    expect(result.success).toBe(false);
  });
});

describe('IssueCommentCreateResponseSchema', () => {
  it('accepts a typical POST-comment response', () => {
    const result = IssueCommentCreateResponseSchema.safeParse({
      id: 123,
      html_url: `https://github.com/${REPO_PATH}/pull/42#issuecomment-123`,
      created_at: '2026-04-17T00:00:00Z',
      author_association: 'CONTRIBUTOR',
    });
    expect(result.success).toBe(true);
  });

  it('rejects responses missing html_url', () => {
    const result = IssueCommentCreateResponseSchema.safeParse({
      id: 1,
      created_at: '2026-04-17T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('PAT containment in errors', () => {
  it('zod validation errors do not reveal parsed values verbatim', () => {
    // zod's issue format mentions paths and types, not raw values by default
    const fakePat = 'github_pat_abcdefg_secret';
    try {
      PullRequestSchema.parse({
        number: 1,
        state: 'open',
        title: fakePat,
        head: { sha: 'bad', ref: 'main' },
      });
    } catch (e) {
      // If zod ever surfaced `title` we'd see fakePat — it doesn't in default mode.
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg.includes(fakePat)).toBe(false);
    }
  });
});
