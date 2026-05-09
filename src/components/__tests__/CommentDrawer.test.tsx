import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentDrawer } from '../CommentDrawer';
import type { Artefact, Comment } from '../../types';

const ARTEFACTS: Artefact[] = [
  {
    name: 'spec.md',
    path: 'specs/191-spec-navigator/spec.md',
    kind: 'spec',
    mimeType: 'text/markdown',
    size: 100,
    downloadUrl: null,
    content: null,
    fetchedAt: null,
  },
  {
    name: 'plan.md',
    path: 'specs/191-spec-navigator/plan.md',
    kind: 'plan',
    mimeType: 'text/markdown',
    size: 80,
    downloadUrl: null,
    content: null,
    fetchedAt: null,
  },
];

const FEATURE_COMMENT: Comment = {
  id: 'comment-feature-1',
  level: 'feature',
  body: 'Whole-feature thought.',
};

const DOC_COMMENT_SPEC: Comment = {
  id: 'comment-doc-spec-1',
  level: 'document',
  path: 'specs/191-spec-navigator/spec.md',
  body: 'Doc comment on spec.',
};

const DOC_COMMENT_PLAN: Comment = {
  id: 'comment-doc-plan-1',
  level: 'document',
  path: 'specs/191-spec-navigator/plan.md',
  body: 'Doc comment on plan.',
};

const DOC_COMMENT_STALE: Comment = {
  id: 'comment-doc-gone-1',
  level: 'document',
  path: 'specs/191-spec-navigator/deleted.md',
  body: 'Doc comment on a removed path.',
};

describe('CommentDrawer', () => {
  it('shows empty-state copy when there are no comments', () => {
    render(
      <CommentDrawer
        comments={[]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={() => {}}
        onClearAll={() => {}}
        quotaError={null}
      />,
    );
    expect(screen.getByText(/No drafts yet/)).toBeTruthy();
  });

  it('groups feature-level under Feature-level and document comments by path', () => {
    render(
      <CommentDrawer
        comments={[FEATURE_COMMENT, DOC_COMMENT_SPEC, DOC_COMMENT_PLAN]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={() => {}}
        onClearAll={() => {}}
        quotaError={null}
      />,
    );
    expect(screen.getByText('Feature-level')).toBeTruthy();
    expect(screen.getByText('specs/191-spec-navigator/spec.md')).toBeTruthy();
    expect(screen.getByText('specs/191-spec-navigator/plan.md')).toBeTruthy();
    expect(screen.getByText('Whole-feature thought.')).toBeTruthy();
    expect(screen.getByText('Doc comment on spec.')).toBeTruthy();
    expect(screen.getByText('Doc comment on plan.')).toBeTruthy();
  });

  it('flags paths not in artefacts with the stale badge', () => {
    render(
      <CommentDrawer
        comments={[DOC_COMMENT_STALE]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={() => {}}
        onClearAll={() => {}}
        quotaError={null}
      />,
    );
    const badges = screen.getAllByText(/stale/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('does not flag paths that are in artefacts', () => {
    render(
      <CommentDrawer
        comments={[DOC_COMMENT_SPEC]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={() => {}}
        onClearAll={() => {}}
        quotaError={null}
      />,
    );
    expect(screen.queryByText(/stale/)).toBeNull();
  });

  it('displays the quota banner when quotaError is set', () => {
    render(
      <CommentDrawer
        comments={[FEATURE_COMMENT]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={() => {}}
        onClearAll={() => {}}
        quotaError="quota-exceeded"
      />,
    );
    expect(screen.getByText(/Local storage is full/)).toBeTruthy();
  });

  it('invokes onEdit with the full Comment when Edit is clicked', () => {
    const onEdit = vi.fn<(c: Comment) => void>();
    render(
      <CommentDrawer
        comments={[FEATURE_COMMENT]}
        artefacts={ARTEFACTS}
        onEdit={onEdit}
        onDelete={() => {}}
        onClearAll={() => {}}
        quotaError={null}
      />,
    );
    fireEvent.click(screen.getByTestId(`drawer-edit-${FEATURE_COMMENT.id}`));
    expect(onEdit).toHaveBeenCalledWith(FEATURE_COMMENT);
  });

  it('Delete requires an explicit confirmation click before firing onDelete', () => {
    const onDelete = vi.fn<(id: string) => void>();
    render(
      <CommentDrawer
        comments={[FEATURE_COMMENT]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={onDelete}
        onClearAll={() => {}}
        quotaError={null}
      />,
    );
    fireEvent.click(screen.getByTestId(`drawer-delete-${FEATURE_COMMENT.id}`));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`drawer-delete-confirm-${FEATURE_COMMENT.id}`));
    expect(onDelete).toHaveBeenCalledWith(FEATURE_COMMENT.id);
  });

  it('Clear all requires a confirmation step before firing onClearAll', () => {
    const onClearAll = vi.fn();
    render(
      <CommentDrawer
        comments={[FEATURE_COMMENT]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={() => {}}
        onClearAll={onClearAll}
        quotaError={null}
      />,
    );
    fireEvent.click(screen.getByTestId('drawer-clear-all'));
    expect(onClearAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('drawer-clear-confirm'));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('can be collapsed and re-expanded', () => {
    render(
      <CommentDrawer
        comments={[FEATURE_COMMENT]}
        artefacts={ARTEFACTS}
        onEdit={() => {}}
        onDelete={() => {}}
        onClearAll={() => {}}
        quotaError={null}
      />,
    );
    fireEvent.click(screen.getByTestId('drawer-collapse'));
    expect(screen.getByTestId('drawer-expand')).toBeTruthy();
    fireEvent.click(screen.getByTestId('drawer-expand'));
    expect(screen.getByTestId('comment-drawer')).toBeTruthy();
  });
});
