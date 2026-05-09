import { useState } from 'react';
import { strings } from '../strings';
import { COMMENT_TAGS, type Comment, type CommentDraft, type CommentTag, type SelectionContext } from '../types';

interface Props {
  level: 'feature' | 'document' | 'selection';
  path?: string;
  selection?: SelectionContext;
  editing?: Comment;
  onSave: (draft: CommentDraft) => void;
  onCancel: () => void;
}

export function CommentComposer({
  level,
  path,
  selection,
  editing,
  onSave,
  onCancel,
}: Props): JSX.Element {
  const [body, setBody] = useState<string>(editing?.body ?? '');
  const [tag, setTag] = useState<CommentTag | ''>(editing?.tag ?? '');
  const [touched, setTouched] = useState<boolean>(false);

  const handleSave = (): void => {
    setTouched(true);
    if (body.trim().length === 0) return;
    const chosenTag: CommentTag | undefined = tag === '' ? undefined : tag;
    if (level === 'feature') {
      onSave({ level: 'feature', body, tag: chosenTag });
    } else if (level === 'document') {
      if (!path) return;
      onSave({ level: 'document', path, body, tag: chosenTag });
    } else if (level === 'selection') {
      if (!path || !selection) return;
      onSave({
        level: 'selection',
        path,
        snippet: selection.snippet,
        contextBefore: selection.contextBefore,
        contextAfter: selection.contextAfter,
        anchorHash: selection.anchorHash,
        body,
        tag: chosenTag,
      });
    }
  };

  const title =
    level === 'feature'
      ? strings.composer.featureScope
      : level === 'document'
        ? strings.composer.documentScope
        : strings.composer.selectionScope;

  return (
    <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        data-testid="comment-composer"
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        {path && <div className="artifact-path">{path}</div>}
        {selection && (
          <blockquote className="composer-snippet">{selection.snippet}</blockquote>
        )}
        <label>
          <div className="artifact-path">{strings.composer.placeholderBody}</div>
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={strings.composer.placeholderBody}
            data-testid="composer-body"
          />
        </label>
        <label>
          <span>{strings.composer.tagLabel}</span>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value as CommentTag | '')}
            data-testid="composer-tag"
          >
            <option value="">{strings.composer.tagNone}</option>
            {COMMENT_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {touched && body.trim().length === 0 && (
          <div className="error-banner" role="alert">
            {strings.composer.emptyBodyError}
          </div>
        )}
        <div className="composer-actions">
          <button type="button" className="btn" onClick={onCancel} data-testid="composer-cancel">
            {strings.buttons.cancel}
          </button>
          <button type="submit" className="btn btn-primary" data-testid="composer-save">
            {strings.buttons.save}
          </button>
        </div>
      </form>
    </div>
  );
}
