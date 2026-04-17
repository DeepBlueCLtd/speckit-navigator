import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  commentsReducer,
  initialCommentsState,
  type CommentsAction,
  type CommentsState,
} from './commentsReducer';
import type { Comment, CommentDraft, CommentTag } from '../types';
import {
  QuotaExceededError,
  clearDraftSet,
  readDraftSet,
  writeDraftSet,
} from './persistence';

export interface UseCommentsResult {
  state: CommentsState;
  addComment: (draft: CommentDraft) => void;
  editComment: (id: string, patch: { body?: string; tag?: CommentTag | null }) => void;
  deleteComment: (id: string) => void;
  clearAll: () => void;
  markSubmitted: () => void;
  countByPath: Record<string, number>;
  selectionAnchorsByPath: Record<string, Array<{ id: string; anchorHash: string; snippet: string }>>;
  quotaError: string | null;
}

function computeCountByPath(comments: Comment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of comments) {
    const key = c.level === 'feature' ? '__feature__' : c.path;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function computeSelectionAnchors(
  comments: Comment[],
): Record<string, Array<{ id: string; anchorHash: string; snippet: string }>> {
  const out: Record<string, Array<{ id: string; anchorHash: string; snippet: string }>> = {};
  for (const c of comments) {
    if (c.level !== 'selection') continue;
    const arr = out[c.path] ?? [];
    arr.push({ id: c.id, anchorHash: c.anchorHash, snippet: c.snippet });
    out[c.path] = arr;
  }
  return out;
}

export function useComments(
  prNumber: number | null,
  headSha: string | undefined,
): UseCommentsResult {
  const [state, dispatch] = useReducer(
    commentsReducer,
    initialCommentsState(prNumber ?? 0, '', headSha ?? ''),
  );
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  // Restore from storage on mount / prNumber change.
  useEffect(() => {
    if (prNumber === null) {
      setLoaded(true);
      return;
    }
    const stored = readDraftSet(prNumber);
    if (stored) {
      dispatch({ type: 'LOAD_FROM_STORAGE', set: stored });
    }
    setLoaded(true);
  }, [prNumber]);

  const persist = useCallback(
    (commentsState: CommentsState): void => {
      if (prNumber === null || !loaded) return;
      try {
        writeDraftSet({
          schemaVersion: 1,
          prNumber,
          featureFolder: commentsState.featureFolder,
          originalHeadSha: commentsState.originalHeadSha,
          comments: commentsState.comments,
          lastModified: new Date().toISOString(),
        });
        setQuotaError(null);
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          setQuotaError('quota-exceeded');
        } else {
          throw e;
        }
      }
    },
    [prNumber, loaded],
  );

  const run = useCallback(
    (action: CommentsAction): void => {
      dispatch(action);
    },
    [],
  );

  // After each reducer run, persist the new state.
  useEffect(() => {
    persist(state);
  }, [state, persist]);

  const addComment = useCallback(
    (draft: CommentDraft): void => {
      run({ type: 'ADD_COMMENT', draft });
    },
    [run],
  );

  const editComment = useCallback(
    (id: string, patch: { body?: string; tag?: CommentTag | null }): void => {
      run({ type: 'EDIT_COMMENT', id, patch });
    },
    [run],
  );

  const deleteComment = useCallback(
    (id: string): void => {
      run({ type: 'DELETE_COMMENT', id });
    },
    [run],
  );

  const clearAll = useCallback((): void => {
    run({ type: 'CLEAR_ALL' });
    if (prNumber !== null) clearDraftSet(prNumber);
  }, [run, prNumber]);

  const markSubmitted = useCallback((): void => {
    run({ type: 'SUBMIT_OK' });
    if (prNumber !== null) clearDraftSet(prNumber);
  }, [run, prNumber]);

  const countByPath = useMemo(() => computeCountByPath(state.comments), [state.comments]);
  const selectionAnchorsByPath = useMemo(
    () => computeSelectionAnchors(state.comments),
    [state.comments],
  );

  return {
    state,
    addComment,
    editComment,
    deleteComment,
    clearAll,
    markSubmitted,
    countByPath,
    selectionAnchorsByPath,
    quotaError,
  };
}
