import { useEffect, useState } from 'react';
import { strings } from './strings';
import { ArtifactTree } from './components/ArtifactTree';
import { ArtifactView } from './components/ArtifactView';
import { CommentDrawer } from './components/CommentDrawer';
import { SubmitButton } from './components/SubmitButton';
import { SettingsPanel } from './components/SettingsPanel';
import { CommentComposer } from './components/CommentComposer';
import { ErrorBanner } from './components/ErrorBanner';
import { useFeature } from './state/useFeature';
import { useComments } from './state/useComments';
import { hasPat } from './github/auth';
import type { Artefact, Comment, SelectionContext } from './types';

function parsePrNumber(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('pr');
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function App(): JSX.Element {
  const [prNumber] = useState<number | null>(() => parsePrNumber());
  const [settingsOpen, setSettingsOpen] = useState<boolean>(() => !hasPat());
  const [composerOpen, setComposerOpen] = useState<boolean>(false);
  const [composerLevel, setComposerLevel] = useState<'feature' | 'document' | 'selection'>('feature');
  const [composerPath, setComposerPath] = useState<string | undefined>(undefined);
  const [composerSelection, setComposerSelection] = useState<SelectionContext | undefined>(undefined);
  const [composerEditing, setComposerEditing] = useState<Comment | undefined>(undefined);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);

  const feature = useFeature(prNumber);
  const comments = useComments(prNumber, feature.scope?.headSha);

  useEffect(() => {
    if (!selectedPath && feature.artefacts.length > 0) {
      const spec = feature.artefacts.find((a) => a.kind === 'spec');
      const first = spec ?? feature.artefacts.find((a) => a.mimeType === 'text/markdown');
      if (first) setSelectedPath(first.path);
    }
  }, [feature.artefacts, selectedPath]);

  const selectedArtefact: Artefact | undefined = feature.artefacts.find((a) => a.path === selectedPath);

  if (prNumber === null) {
    return (
      <div className="app-missing-pr">
        <h1>{strings.app.title}</h1>
        <p>{strings.errors.noPrParam}</p>
      </div>
    );
  }

  const openComposer = (
    level: 'feature' | 'document' | 'selection',
    path?: string,
    selection?: SelectionContext,
  ): void => {
    setComposerLevel(level);
    setComposerPath(path);
    setComposerSelection(selection);
    setComposerEditing(undefined);
    setComposerOpen(true);
  };

  const editComment = (comment: Comment): void => {
    setComposerEditing(comment);
    setComposerLevel(comment.level);
    setComposerPath(comment.level === 'feature' ? undefined : comment.path);
    setComposerSelection(
      comment.level === 'selection'
        ? {
            snippet: comment.snippet,
            contextBefore: comment.contextBefore,
            contextAfter: comment.contextAfter,
            anchorHash: comment.anchorHash,
          }
        : undefined,
    );
    setComposerOpen(true);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">{strings.app.title}</h1>
        <div className="app-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openComposer('feature')}
            data-testid="comment-feature-button"
          >
            {strings.buttons.commentFeature}
          </button>
          <SubmitButton
            prNumber={prNumber}
            comments={comments.state.comments}
            originalHeadSha={feature.scope?.headSha}
            onSuccess={() => {
              comments.clearAll();
            }}
          />
          <button
            type="button"
            className="btn btn-icon"
            aria-label={strings.buttons.openSettings}
            onClick={() => setSettingsOpen((s) => !s)}
            data-testid="settings-toggle"
          >
            ⚙
          </button>
        </div>
      </header>
      {feature.error && <ErrorBanner message={feature.error} />}
      <main className="app-main">
        <aside className="app-tree">
          <ArtifactTree
            artefacts={feature.artefacts}
            selectedPath={selectedPath}
            commentCountByPath={comments.countByPath}
            onSelect={setSelectedPath}
          />
        </aside>
        <section className="app-view">
          {selectedArtefact ? (
            <ArtifactView
              artefact={selectedArtefact}
              scope={feature.scope ?? null}
              artefacts={feature.artefacts}
              onAddDocumentComment={() => openComposer('document', selectedArtefact.path)}
              onAddSelectionComment={(sel) =>
                openComposer('selection', selectedArtefact.path, sel)
              }
              onCrossLinkNavigate={(path) => setSelectedPath(path)}
              commentAnchors={comments.selectionAnchorsByPath[selectedArtefact.path] ?? []}
            />
          ) : feature.loading ? (
            <div className="app-loading">{strings.app.loading}</div>
          ) : (
            <div className="app-empty">{strings.app.selectArtefact}</div>
          )}
        </section>
      </main>
      <CommentDrawer
        comments={comments.state.comments}
        artefacts={feature.artefacts}
        onEdit={editComment}
        onDelete={(id) => comments.deleteComment(id)}
        onClearAll={() => comments.clearAll()}
        quotaError={comments.quotaError}
      />
      {composerOpen && (
        <CommentComposer
          level={composerLevel}
          path={composerPath}
          selection={composerSelection}
          editing={composerEditing}
          onSave={(data) => {
            if (composerEditing) {
              comments.editComment(composerEditing.id, data);
            } else {
              comments.addComment(data);
            }
            setComposerOpen(false);
          }}
          onCancel={() => setComposerOpen(false)}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
