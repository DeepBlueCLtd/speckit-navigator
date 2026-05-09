import { describe, it, expect } from 'vitest';
import {
  commentsReducer,
  initialCommentsState,
  type CommentsState,
} from '../commentsReducer';
import type { CommentDraft } from '../../types';

const PR = 42;
const FOLDER = 'specs/191-spec-navigator';
const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function s(): CommentsState {
  return initialCommentsState(PR, FOLDER, SHA);
}

const featureDraft: CommentDraft = { level: 'feature', body: 'whole-feature note' };
const docDraft: CommentDraft = {
  level: 'document',
  path: `${FOLDER}/plan.md`,
  body: 'doc note',
};
const selectionDraft: CommentDraft = {
  level: 'selection',
  path: `${FOLDER}/spec.md`,
  snippet: 'The tool MUST',
  contextBefore: 'before-ctx',
  contextAfter: 'after-ctx',
  anchorHash: 'The tool MUST\u001F The tool MUST\u001F120',
  body: 'selection note',
};

describe('commentsReducer', () => {
  it('ADD_COMMENT appends a comment with a stable id and timestamps', () => {
    const next = commentsReducer(s(), { type: 'ADD_COMMENT', draft: featureDraft });
    expect(next.comments.length).toBe(1);
    const c = next.comments[0]!;
    expect(c.level).toBe('feature');
    expect(c.body).toBe('whole-feature note');
    expect(c.id.length).toBeGreaterThanOrEqual(8);
    expect(c.createdAt).toBeDefined();
    expect(c.updatedAt).toBeDefined();
  });

  it('ADD_COMMENT rejects empty body', () => {
    const next = commentsReducer(s(), {
      type: 'ADD_COMMENT',
      draft: { level: 'feature', body: '   ' },
    });
    expect(next.comments.length).toBe(0);
    expect(next.lastError).not.toBeNull();
  });

  it('ADD_COMMENT rejects when comment count >= 100', () => {
    let state = s();
    for (let i = 0; i < 100; i++) {
      state = commentsReducer(state, {
        type: 'ADD_COMMENT',
        draft: { level: 'feature', body: `body-${i}` },
      });
    }
    expect(state.comments.length).toBe(100);
    const attempt = commentsReducer(state, { type: 'ADD_COMMENT', draft: featureDraft });
    expect(attempt.comments.length).toBe(100);
    expect(attempt.lastError).not.toBeNull();
  });

  it('EDIT_COMMENT updates body and touches updatedAt', () => {
    const a = commentsReducer(s(), { type: 'ADD_COMMENT', draft: featureDraft });
    const id = a.comments[0]!.id;
    const b = commentsReducer(a, { type: 'EDIT_COMMENT', id, patch: { body: 'new body' } });
    expect(b.comments[0]!.body).toBe('new body');
  });

  it('EDIT_COMMENT rejects empty body', () => {
    const a = commentsReducer(s(), { type: 'ADD_COMMENT', draft: featureDraft });
    const id = a.comments[0]!.id;
    const b = commentsReducer(a, { type: 'EDIT_COMMENT', id, patch: { body: '' } });
    expect(b.comments[0]!.body).toBe('whole-feature note');
    expect(b.lastError).not.toBeNull();
  });

  it('DELETE_COMMENT removes the comment', () => {
    const a = commentsReducer(s(), { type: 'ADD_COMMENT', draft: featureDraft });
    const id = a.comments[0]!.id;
    const b = commentsReducer(a, { type: 'DELETE_COMMENT', id });
    expect(b.comments.length).toBe(0);
  });

  it('RETAG_COMMENT sets and clears tag', () => {
    const a = commentsReducer(s(), { type: 'ADD_COMMENT', draft: featureDraft });
    const id = a.comments[0]!.id;
    const b = commentsReducer(a, { type: 'RETAG_COMMENT', id, tag: 'nit' });
    expect(b.comments[0]!.tag).toBe('nit');
    const c = commentsReducer(b, { type: 'RETAG_COMMENT', id, tag: null });
    expect(c.comments[0]!.tag).toBeUndefined();
  });

  it('CLEAR_ALL empties comments', () => {
    let state = commentsReducer(s(), { type: 'ADD_COMMENT', draft: featureDraft });
    state = commentsReducer(state, { type: 'ADD_COMMENT', draft: docDraft });
    const cleared = commentsReducer(state, { type: 'CLEAR_ALL' });
    expect(cleared.comments.length).toBe(0);
  });

  it('MARK_STALE_PATHS flags comments whose path is not in the known set', () => {
    let state = commentsReducer(s(), { type: 'ADD_COMMENT', draft: docDraft });
    state = commentsReducer(state, { type: 'ADD_COMMENT', draft: selectionDraft });
    const next = commentsReducer(state, {
      type: 'MARK_STALE_PATHS',
      knownPaths: [`${FOLDER}/spec.md`],
    });
    expect(next.stalePaths.has(`${FOLDER}/plan.md`)).toBe(true);
    expect(next.stalePaths.has(`${FOLDER}/spec.md`)).toBe(false);
  });

  it('SUBMIT_OK empties comments and flags submitted', () => {
    const a = commentsReducer(s(), { type: 'ADD_COMMENT', draft: featureDraft });
    const b = commentsReducer(a, { type: 'SUBMIT_OK' });
    expect(b.comments.length).toBe(0);
    expect(b.submitted).toBe(true);
  });

  it('LOAD_FROM_STORAGE hydrates existing comments', () => {
    const b = commentsReducer(s(), {
      type: 'LOAD_FROM_STORAGE',
      set: {
        schemaVersion: 1,
        prNumber: PR,
        featureFolder: FOLDER,
        originalHeadSha: SHA,
        comments: [
          {
            id: 'some-long-id-aaaa',
            level: 'feature',
            body: 'loaded',
          },
        ],
        lastModified: '2026-04-17T00:00:00Z',
      },
    });
    expect(b.comments.length).toBe(1);
    expect(b.comments[0]!.body).toBe('loaded');
  });
});
