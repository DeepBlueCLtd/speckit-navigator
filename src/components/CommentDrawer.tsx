import { useMemo, useState } from 'react';
import { strings } from '../strings';
import type { Artefact, Comment } from '../types';

interface Props {
  comments: Comment[];
  artefacts: Artefact[];
  onEdit: (comment: Comment) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  quotaError: string | null;
}

export function CommentDrawer({
  comments,
  artefacts,
  onEdit,
  onDelete,
  onClearAll,
  quotaError,
}: Props): JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const knownPaths = useMemo(() => new Set(artefacts.map((a) => a.path)), [artefacts]);

  const groups = useMemo(() => {
    const featureGroup: Comment[] = [];
    const byPath = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.level === 'feature') {
        featureGroup.push(c);
      } else {
        const arr = byPath.get(c.path) ?? [];
        arr.push(c);
        byPath.set(c.path, arr);
      }
    }
    return { featureGroup, byPath };
  }, [comments]);

  if (collapsed) {
    return (
      <aside className="drawer is-collapsed" aria-label={strings.drawer.title}>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => setCollapsed(false)}
          aria-label={`Expand ${strings.drawer.title}`}
          data-testid="drawer-expand"
        >
          ◀ {comments.length}
        </button>
      </aside>
    );
  }

  return (
    <aside className="drawer" aria-label={strings.drawer.title} data-testid="comment-drawer">
      <div className="drawer-header">
        <strong>
          {strings.drawer.title} ({comments.length})
        </strong>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => setCollapsed(true)}
          aria-label={`Collapse ${strings.drawer.title}`}
          data-testid="drawer-collapse"
        >
          ▶
        </button>
      </div>
      {quotaError && <div className="quota-banner">{strings.drawer.quotaWarning}</div>}
      <div className="drawer-body">
        {comments.length === 0 && <p className="drawer-empty">{strings.drawer.empty}</p>}
        {groups.featureGroup.length > 0 && (
          <>
            <div className="drawer-group-header">{strings.drawer.featureGroup}</div>
            {groups.featureGroup.map((c) => (
              <DrawerEntry
                key={c.id}
                comment={c}
                isStale={false}
                onEdit={onEdit}
                onDelete={onDelete}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
              />
            ))}
          </>
        )}
        {[...groups.byPath.entries()].map(([path, items]) => {
          const stale = !knownPaths.has(path);
          return (
            <div key={path}>
              <div className="drawer-group-header">
                {path}
                {stale && <span className="stale-badge">{strings.drawer.staleBadge}</span>}
              </div>
              {items.map((c) => (
                <DrawerEntry
                  key={c.id}
                  comment={c}
                  isStale={stale}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  confirmDelete={confirmDelete}
                  setConfirmDelete={setConfirmDelete}
                />
              ))}
            </div>
          );
        })}
      </div>
      {comments.length > 0 && (
        <div className="drawer-footer">
          {confirmClear ? (
            <>
              <span>{strings.buttons.confirmClearAll}</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => setConfirmClear(false)}>
                  {strings.buttons.cancel}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  data-testid="drawer-clear-confirm"
                >
                  {strings.buttons.clearAll}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmClear(true)}
              data-testid="drawer-clear-all"
            >
              {strings.buttons.clearAll}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

interface EntryProps {
  comment: Comment;
  isStale: boolean;
  onEdit: (comment: Comment) => void;
  onDelete: (id: string) => void;
  confirmDelete: string | null;
  setConfirmDelete: (id: string | null) => void;
}

function DrawerEntry({
  comment,
  isStale,
  onEdit,
  onDelete,
  confirmDelete,
  setConfirmDelete,
}: EntryProps): JSX.Element {
  const isConfirming = confirmDelete === comment.id;
  return (
    <div className="drawer-entry" data-testid={`drawer-entry-${comment.id}`}>
      {comment.tag && <span className="tag-chip">{comment.tag}</span>}
      {isStale && <span className="stale-badge">{strings.drawer.staleBadge}</span>}
      <div style={{ fontSize: 13, marginTop: 4 }}>{comment.body}</div>
      {comment.level === 'selection' && (
        <blockquote className="composer-snippet" style={{ marginTop: 6 }}>
          {comment.snippet}
        </blockquote>
      )}
      <div className="drawer-entry-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onEdit(comment)}
          data-testid={`drawer-edit-${comment.id}`}
        >
          {strings.buttons.edit}
        </button>
        {isConfirming ? (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmDelete(null)}
            >
              {strings.buttons.cancel}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                onDelete(comment.id);
                setConfirmDelete(null);
              }}
              data-testid={`drawer-delete-confirm-${comment.id}`}
            >
              {strings.buttons.confirmDelete}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmDelete(comment.id)}
            data-testid={`drawer-delete-${comment.id}`}
          >
            {strings.buttons.delete}
          </button>
        )}
      </div>
    </div>
  );
}
