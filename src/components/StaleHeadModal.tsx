import { strings } from '../strings';

interface Props {
  originalHeadSha: string;
  currentHeadSha: string;
  onSubmitAnyway: () => void;
  onCancel: () => void;
}

export function StaleHeadModal({
  originalHeadSha,
  currentHeadSha,
  onSubmitAnyway,
  onCancel,
}: Props): JSX.Element {
  return (
    <div
      className="composer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={strings.submit.staleHeadTitle}
      data-testid="stale-head-modal"
    >
      <div className="composer">
        <h3 style={{ margin: 0 }}>{strings.submit.staleHeadTitle}</h3>
        <p>{strings.submit.staleHeadBody}</p>
        <dl style={{ margin: 0 }}>
          <dt>{strings.submit.staleHeadOriginal}</dt>
          <dd>
            <code>{originalHeadSha.slice(0, 7)}</code>
          </dd>
          <dt>{strings.submit.staleHeadCurrent}</dt>
          <dd>
            <code>{currentHeadSha.slice(0, 7)}</code>
          </dd>
        </dl>
        <div className="composer-actions">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            data-testid="stale-head-cancel"
          >
            {strings.buttons.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmitAnyway}
            data-testid="stale-head-submit-anyway"
          >
            {strings.buttons.submitAnyway}
          </button>
        </div>
      </div>
    </div>
  );
}
