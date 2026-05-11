import { memo, useEffect, useRef, useState } from 'react';
import { strings } from '../strings';
import type { Artefact, FeatureScope, SelectionContext } from '../types';
import { MarkdownView } from './MarkdownView';
import { CodeView } from './CodeView';
import { ImageView } from './ImageView';
import { SelectionAnchor } from './SelectionAnchor';
import { fetchRawBlob, fetchRawText, ApiError } from '../github/api';

interface Props {
  artefact: Artefact;
  scope: FeatureScope | null;
  artefacts: Artefact[];
  onAddDocumentComment: () => void;
  onAddSelectionComment: (selection: SelectionContext) => void;
  onCrossLinkNavigate: (path: string) => void;
  commentAnchors: Array<{ id: string; anchorHash: string; snippet: string }>;
}

type ContentState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded-text'; text: string }
  | { kind: 'loaded-blob'; blob: Blob }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

function ArtifactViewImpl({
  artefact,
  scope,
  artefacts: _artefacts,
  onAddDocumentComment,
  onAddSelectionComment,
  onCrossLinkNavigate,
}: Props): JSX.Element {
  const [content, setContent] = useState<ContentState>({ kind: 'idle' });
  const [rawMode, setRawMode] = useState<boolean>(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    setContent({ kind: 'loading' });
    setRawMode(false);

    (async (): Promise<void> => {
      try {
        if (
          artefact.mimeType === 'text/markdown' ||
          artefact.mimeType === 'application/json' ||
          artefact.mimeType === 'application/yaml' ||
          artefact.mimeType === 'text/plain'
        ) {
          const text = await fetchRawText(artefact.path, scope.headSha);
          if (!cancelled) setContent({ kind: 'loaded-text', text });
          return;
        }
        if (
          artefact.mimeType === 'image/png' ||
          artefact.mimeType === 'image/jpeg' ||
          artefact.mimeType === 'image/gif'
        ) {
          const blob = await fetchRawBlob(artefact.path, scope.headSha);
          if (!cancelled) setContent({ kind: 'loaded-blob', blob });
          return;
        }
        if (!cancelled) setContent({ kind: 'unsupported' });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : strings.errors.unknown;
        setContent({ kind: 'error', message: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artefact.path, artefact.mimeType, scope]);

  const canToggleRaw =
    content.kind === 'loaded-text' && artefact.mimeType === 'text/markdown';

  return (
    <div className="artifact-view">
      <div className="artifact-header">
        <div>
          <div className="artifact-name" style={{ fontWeight: 600 }}>
            {artefact.name}
          </div>
          <div className="artifact-path">{artefact.path}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canToggleRaw && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRawMode((r) => !r)}
              data-testid="raw-toggle"
            >
              {rawMode ? strings.buttons.toggleRendered : strings.buttons.toggleRaw}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAddDocumentComment}
            data-testid="comment-document-button"
          >
            {strings.buttons.commentDocument}
          </button>
        </div>
      </div>

      <div ref={bodyRef} className="artifact-body-wrapper">
        {content.kind === 'loading' && <div className="app-loading">{strings.app.loading}</div>}
        {content.kind === 'error' && <div className="error-banner">{content.message}</div>}
        {content.kind === 'unsupported' && (
          <div className="app-empty">{strings.artifactView.cannotPreview}</div>
        )}
        {content.kind === 'loaded-text' && !rawMode && artefact.mimeType === 'text/markdown' && (
          <>
            <MarkdownView
              content={content.text}
              artefactPath={artefact.path}
              scope={scope}
              artefacts={_artefacts}
              onCrossLinkNavigate={onCrossLinkNavigate}
            />
            <SelectionAnchor
              source={content.text}
              containerRef={bodyRef}
              onAddSelectionComment={onAddSelectionComment}
            />
          </>
        )}
        {content.kind === 'loaded-text' && !rawMode && artefact.mimeType !== 'text/markdown' && (
          <CodeView content={content.text} mimeType={artefact.mimeType} />
        )}
        {content.kind === 'loaded-text' && rawMode && (
          <pre className="artifact-raw" data-testid="raw-body">
            {content.text}
          </pre>
        )}
        {content.kind === 'loaded-blob' && <ImageView blob={content.blob} name={artefact.name} />}
      </div>
    </div>
  );
}

export const ArtifactView = memo(ArtifactViewImpl);
