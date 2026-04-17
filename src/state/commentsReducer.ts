/**
 * Pure reducer over a unified Comment[]. The only module that constructs
 * comment IDs and timestamps; UI callers pass in `CommentDraft` shapes.
 */

import { ulid } from 'ulid';
import type { Comment, CommentDraft, DraftCommentSet, CommentTag, AppError } from '../types';

const MAX_COMMENTS = 100;
const MAX_BODY = 10000;
const MAX_SNIPPET = 2000;

export interface CommentsState {
  comments: Comment[];
  originalHeadSha: string;
  featureFolder: string;
  prNumber: number;
  stalePaths: Set<string>;
  submitted: boolean;
  /** Error from the last mutation attempt — cleared by subsequent actions. */
  lastError: AppError | null;
}

export type CommentsAction =
  | { type: 'ADD_COMMENT'; draft: CommentDraft }
  | { type: 'EDIT_COMMENT'; id: string; patch: { body?: string; tag?: CommentTag | null } }
  | { type: 'DELETE_COMMENT'; id: string }
  | { type: 'RETAG_COMMENT'; id: string; tag: CommentTag | null }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD_FROM_STORAGE'; set: DraftCommentSet }
  | { type: 'MARK_STALE_PATHS'; knownPaths: string[] }
  | { type: 'SUBMIT_OK' };

export const initialCommentsState = (
  prNumber: number,
  featureFolder: string,
  originalHeadSha: string,
): CommentsState => ({
  comments: [],
  originalHeadSha,
  featureFolder,
  prNumber,
  stalePaths: new Set(),
  submitted: false,
  lastError: null,
});

function nowIso(): string {
  return new Date().toISOString();
}

function appError(kind: AppError['kind'], message: string): AppError {
  return { kind, message };
}

function makeComment(draft: CommentDraft): Comment {
  const id = ulid();
  const createdAt = nowIso();
  const updatedAt = createdAt;
  const base = { id, body: draft.body.trim(), tag: draft.tag, createdAt, updatedAt };
  switch (draft.level) {
    case 'feature':
      return { ...base, level: 'feature' };
    case 'document':
      return { ...base, level: 'document', path: draft.path };
    case 'selection':
      return {
        ...base,
        level: 'selection',
        path: draft.path,
        snippet: draft.snippet,
        contextBefore: draft.contextBefore,
        contextAfter: draft.contextAfter,
        anchorHash: draft.anchorHash,
      };
  }
}

export function commentsReducer(
  state: CommentsState,
  action: CommentsAction,
): CommentsState {
  switch (action.type) {
    case 'ADD_COMMENT': {
      const body = action.draft.body.trim();
      if (body.length === 0) {
        return {
          ...state,
          lastError: appError('unknown', 'Comment body cannot be empty'),
        };
      }
      if (body.length > MAX_BODY) {
        return {
          ...state,
          lastError: appError('unknown', `Comment body is too long (max ${MAX_BODY} chars)`),
        };
      }
      if (
        action.draft.level === 'selection' &&
        action.draft.snippet.length > MAX_SNIPPET
      ) {
        return {
          ...state,
          lastError: appError('unknown', 'Selection is too long — narrow your highlight'),
        };
      }
      if (state.comments.length >= MAX_COMMENTS) {
        return {
          ...state,
          lastError: appError('unknown', `Too many drafts (max ${MAX_COMMENTS})`),
        };
      }
      const next = makeComment(action.draft);
      return {
        ...state,
        comments: [...state.comments, next],
        lastError: null,
      };
    }
    case 'EDIT_COMMENT': {
      const idx = state.comments.findIndex((c) => c.id === action.id);
      if (idx < 0) return state;
      const current = state.comments[idx]!;
      let body = current.body;
      if (action.patch.body !== undefined) {
        const trimmed = action.patch.body.trim();
        if (trimmed.length === 0) {
          return {
            ...state,
            lastError: appError('unknown', 'Comment body cannot be empty'),
          };
        }
        if (trimmed.length > MAX_BODY) {
          return {
            ...state,
            lastError: appError('unknown', `Comment body is too long (max ${MAX_BODY} chars)`),
          };
        }
        body = trimmed;
      }
      let tag: CommentTag | undefined = current.tag;
      if (action.patch.tag === null) {
        tag = undefined;
      } else if (action.patch.tag !== undefined) {
        tag = action.patch.tag;
      }
      const updated: Comment = { ...current, body, tag, updatedAt: nowIso() };
      const comments = state.comments.slice();
      comments[idx] = updated;
      return { ...state, comments, lastError: null };
    }
    case 'DELETE_COMMENT': {
      const comments = state.comments.filter((c) => c.id !== action.id);
      return { ...state, comments, lastError: null };
    }
    case 'RETAG_COMMENT': {
      const idx = state.comments.findIndex((c) => c.id === action.id);
      if (idx < 0) return state;
      const current = state.comments[idx]!;
      const updated: Comment = {
        ...current,
        tag: action.tag ?? undefined,
        updatedAt: nowIso(),
      };
      const comments = state.comments.slice();
      comments[idx] = updated;
      return { ...state, comments, lastError: null };
    }
    case 'CLEAR_ALL':
      return { ...state, comments: [], stalePaths: new Set(), lastError: null };
    case 'LOAD_FROM_STORAGE':
      return {
        ...state,
        comments: action.set.comments,
        originalHeadSha: action.set.originalHeadSha,
        featureFolder: action.set.featureFolder,
        lastError: null,
      };
    case 'MARK_STALE_PATHS': {
      const known = new Set(action.knownPaths);
      const stale = new Set<string>();
      for (const c of state.comments) {
        if (c.level !== 'feature' && !known.has(c.path)) {
          stale.add(c.path);
        }
      }
      return { ...state, stalePaths: stale };
    }
    case 'SUBMIT_OK':
      return {
        ...state,
        comments: [],
        stalePaths: new Set(),
        submitted: true,
        lastError: null,
      };
  }
}

export function hasEmptyBody(draft: CommentDraft): boolean {
  return draft.body.trim().length === 0;
}
