import { describe, it, expect } from 'vitest';
import { renderFeedbackComment, TRIGGER } from '../renderFeedbackComment';
import type { Submission } from '../../types';

const SAMPLE: Submission = {
  schemaVersion: 'spec-review-feedback-v1',
  feature: '186-filter-chips',
  pr: 187,
  originalHeadSha: 'f3a2b1c4d5e6f7081920aabbccddeeff00112233',
  submittedAtHeadSha: 'f3a2b1c4d5e6f7081920aabbccddeeff00112233',
  submittedAt: '2026-04-17T14:23:07Z',
  comments: [
    {
      id: '01HW7GX0P0EXAMPLE0000001',
      level: 'feature',
      tag: 'scope-concern',
      body:
        'The chip-palette behaviour for multi-select feels like a separate feature — consider splitting.',
    },
    {
      id: '01HW7GX0P0EXAMPLE0000002',
      level: 'document',
      path: 'specs/186-filter-chips/plan.md',
      tag: 'question',
      body: 'Why do we need a new dnd-kit wrapper — can we reuse the one from #127?',
    },
    {
      id: '01HW7GX0P0EXAMPLE0000003',
      level: 'selection',
      path: 'specs/186-filter-chips/spec.md',
      snippet: 'The tool MUST resolve the identified scope to the exact commit under review',
      contextBefore: 'the reviewer was given.\n- **FR-002**: ',
      contextAfter: ', so that what the reviewer sees matches',
      anchorHash: 'The tool MUST resolve\u001F commit under review\u001F1842',
      tag: 'test-gap',
      body:
        'This needs an acceptance scenario — no test currently asserts the pinned-SHA behaviour.',
    },
    {
      id: '01HW7GX0P0EXAMPLE0000004',
      level: 'document',
      path: 'specs/186-filter-chips/tasks.md',
      tag: 'nit',
      body: 'Task T-014 and T-015 could be merged — they touch the same component.',
    },
    {
      id: '01HW7GX0P0EXAMPLE0000005',
      level: 'feature',
      tag: 'blocker',
      body:
        'Does this need an ADR? The dnd-kit direction is a departure from #127 and should be captured in docs/project_notes/decisions.md before merge.',
    },
  ],
};

describe('renderFeedbackComment', () => {
  it('starts with the exact trigger phrase', () => {
    const out = renderFeedbackComment(SAMPLE);
    expect(out.startsWith(`${TRIGGER}\n`)).toBe(true);
  });

  it('embeds a fenced json block tagged spec-review-feedback-v1', () => {
    const out = renderFeedbackComment(SAMPLE);
    expect(out).toContain('```json spec-review-feedback-v1\n');
    expect(out).toContain('\n```\n');
  });

  it('embedded JSON parses to an object with all required fields', () => {
    const out = renderFeedbackComment(SAMPLE);
    const match = out.match(/```json spec-review-feedback-v1\n([\s\S]*?)\n```/);
    expect(match).not.toBeNull();
    const payload = JSON.parse(match![1]);
    expect(payload.schemaVersion).toBe('spec-review-feedback-v1');
    expect(payload.feature).toBe('186-filter-chips');
    expect(payload.pr).toBe(187);
    expect(payload.originalHeadSha).toBe(SAMPLE.originalHeadSha);
    expect(payload.submittedAtHeadSha).toBe(SAMPLE.submittedAtHeadSha);
    expect(payload.comments.length).toBe(5);
  });

  it('renders human-readable sections for feature-level and per-path', () => {
    const out = renderFeedbackComment(SAMPLE);
    expect(out).toContain('## Feature-level');
    expect(out).toContain('## specs/186-filter-chips/plan.md');
    expect(out).toContain('## specs/186-filter-chips/tasks.md');
    expect(out).toContain('## specs/186-filter-chips/spec.md — selection');
  });

  it('renders tag bullets as "- **tag** — body"', () => {
    const out = renderFeedbackComment(SAMPLE);
    expect(out).toContain(
      '- **scope-concern** — The chip-palette behaviour for multi-select feels like a separate feature — consider splitting.',
    );
    expect(out).toContain(
      '- **question** — Why do we need a new dnd-kit wrapper — can we reuse the one from #127?',
    );
  });

  it('renders untagged bullets as "- body"', () => {
    const sample: Submission = {
      ...SAMPLE,
      comments: [
        { id: 'untagged-id-aaaa', level: 'feature', body: 'Just a note.' },
      ],
    };
    const out = renderFeedbackComment(sample);
    expect(out).toContain('- Just a note.');
    expect(out).not.toContain('**undefined**');
  });

  it('emits the selection snippet blockquote above the selection bullet', () => {
    const out = renderFeedbackComment(SAMPLE);
    const idx = out.indexOf('## specs/186-filter-chips/spec.md — selection');
    const section = out.slice(idx);
    const blockquoteAt = section.indexOf(
      '> The tool MUST resolve the identified scope to the exact commit under review',
    );
    const bulletAt = section.indexOf(
      '- **test-gap** — This needs an acceptance scenario',
    );
    expect(blockquoteAt).toBeGreaterThan(0);
    expect(bulletAt).toBeGreaterThan(blockquoteAt);
  });

  it('adds stale-head admonition when SHAs differ', () => {
    const stale: Submission = {
      ...SAMPLE,
      submittedAtHeadSha: 'ffffffffffffffffffffffffffffffffffffffff',
    };
    const out = renderFeedbackComment(stale);
    expect(out).toContain('> ⚠️ Drafted against commit `f3a2b1c`');
    expect(out).toContain('submitted against commit `fffffff`');
  });

  it('omits stale-head admonition when SHAs match', () => {
    const out = renderFeedbackComment(SAMPLE);
    expect(out).not.toContain('⚠️');
  });

  it('ends with exactly one trailing newline', () => {
    const out = renderFeedbackComment(SAMPLE);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });
});
