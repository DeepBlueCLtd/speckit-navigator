import { useState } from 'react';
import { strings } from '../strings';
import { clearPat, getPat, hasPat, setPat } from '../github/auth';
import { fetchPullRequest, ApiError } from '../github/api';

interface Props {
  onClose: () => void;
}

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function SettingsPanel({ onClose }: Props): JSX.Element {
  const [value, setValue] = useState<string>(getPat() ?? '');
  const [revealed, setRevealed] = useState<boolean>(false);
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' });

  const handleSave = async (): Promise<void> => {
    if (!value.trim()) return;
    setPat(value.trim());
    setProbe({ kind: 'probing' });
    try {
      // Lightweight probe: fetch PR #1 — most public repos have one; if the
      // repo does not, we treat "pr-not-found" as a successful auth signal
      // (token can see the repo, just no PR #1).
      await fetchPullRequest(1);
      setProbe({ kind: 'success' });
      setTimeout(onClose, 800);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.kind === 'pr-not-found') {
          setProbe({ kind: 'success' });
          setTimeout(onClose, 800);
          return;
        }
        setProbe({ kind: 'error', message: strings.settings.probeFailScope });
      } else {
        setProbe({ kind: 'error', message: strings.errors.unknown });
      }
    }
  };

  const handleClear = (): void => {
    clearPat();
    setValue('');
    setProbe({ kind: 'idle' });
  };

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={strings.settings.title}
      data-testid="settings-panel"
    >
      <div className="settings-panel">
        <h3 style={{ margin: 0 }}>{strings.settings.title}</h3>
        <p>{strings.settings.patHelp}</p>
        <p>
          <a
            href={strings.settings.patCreateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            {strings.settings.patCreateLink}
          </a>
        </p>
        <label>
          <div>{strings.settings.patLabel}</div>
          <input
            type={revealed ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            data-testid="settings-pat-input"
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setRevealed((r) => !r)}
            data-testid="settings-reveal"
          >
            {revealed ? strings.buttons.hide : strings.buttons.reveal}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleClear}
            disabled={!hasPat() && !value}
            data-testid="settings-clear"
          >
            {strings.buttons.clearCredential}
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn"
            onClick={onClose}
            data-testid="settings-close"
          >
            {strings.buttons.closeSettings}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={!value.trim() || probe.kind === 'probing'}
            data-testid="settings-save"
          >
            {strings.buttons.saveCredential}
          </button>
        </div>
        {probe.kind === 'probing' && <div>…</div>}
        {probe.kind === 'success' && (
          <div className="success-panel">{strings.settings.probeSuccess}</div>
        )}
        {probe.kind === 'error' && (
          <div className="error-banner" role="alert">
            {probe.message}
          </div>
        )}
        <div>{hasPat() ? strings.settings.patStored : strings.settings.patNotStored}</div>
      </div>
    </div>
  );
}
