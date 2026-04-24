import { useEffect } from 'react';
import { strings } from '../strings';
import { OpenPrList } from './OpenPrList';

interface Props {
  onClose: () => void;
}

/**
 * Modal overlay that lists every open PR so the reviewer can switch
 * feature scope without knowing the PR number. Reused by both the
 * header "Browse open PRs" button and the "No ?pr= param" fallback
 * screen.
 */
export function SpecBrowserModal({ onClose }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={strings.specBrowser.modalTitle}
      data-testid="spec-browser-modal"
    >
      <div className="settings-panel spec-browser-panel">
        <div className="spec-browser-header">
          <h3 style={{ margin: 0 }}>{strings.specBrowser.modalTitle}</h3>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            data-testid="spec-browser-close"
          >
            {strings.specBrowser.closeButton}
          </button>
        </div>
        <OpenPrList />
      </div>
    </div>
  );
}
