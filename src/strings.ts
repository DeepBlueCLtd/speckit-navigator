/**
 * Centralised user-facing strings (i18n-ready; no per-file literals).
 * Future translation: replace the default export with a locale-resolving function.
 */

import { DEFAULT_REPO_LABEL } from './defaults';

export const strings = {
  app: {
    title: 'Spec Navigator',
    loading: 'Loading artefacts…',
    selectArtefact: 'Select an artefact from the tree on the left.',
  },
  buttons: {
    commentFeature: 'Comment on whole feature',
    commentDocument: 'Comment on this document',
    commentSelection: 'Add comment on selection',
    submit: 'Submit feedback',
    submitting: 'Submitting…',
    submitAnyway: 'Submit anyway',
    copyFeedback: 'Copy feedback for PR',
    copyFeedbackCopied: 'Copied — paste it as a PR comment',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Really delete?',
    clearAll: 'Clear all drafts',
    confirmClearAll: 'Clear every draft for this PR?',
    openSettings: 'Open settings',
    closeSettings: 'Close settings',
    saveCredential: 'Save token',
    clearCredential: 'Clear token',
    reveal: 'Reveal',
    hide: 'Hide',
    toggleRaw: 'Show raw source',
    toggleRendered: 'Show rendered',
    dismissReadOnlyHint: 'Dismiss',
  },
  composer: {
    placeholderBody: 'Describe your feedback…',
    tagLabel: 'Tag',
    tagNone: 'No tag',
    featureScope: 'Comment on whole feature',
    documentScope: 'Comment on document',
    selectionScope: 'Comment on selection',
    emptyBodyError: 'Please enter some feedback before saving.',
  },
  drawer: {
    title: 'Drafts',
    empty:
      'No drafts yet. Select text and click "Add comment on selection", or use "Comment on this document" / "Comment on whole feature".',
    featureGroup: 'Feature-level',
    staleBadge: 'stale (target no longer present)',
    quotaWarning:
      'Local storage is full. Drafts are kept in memory for this session only — submit soon or free up storage.',
  },
  submit: {
    success: 'Feedback submitted.',
    viewComment: 'View comment on GitHub',
    empty: 'Add at least one comment before submitting.',
    staleHeadTitle: 'Pull request moved during your review',
    staleHeadBody:
      'The PR head commit has changed since you loaded the navigator. The artefacts you reviewed may no longer match what is on the PR.',
    staleHeadOriginal: 'You reviewed commit',
    staleHeadCurrent: 'Current commit',
  },
  settings: {
    title: 'GitHub credential',
    patLabel: 'Fine-grained PAT',
    patHelp: `Generate a fine-grained personal access token scoped to ${DEFAULT_REPO_LABEL} with permissions: "Contents: Read" and "Pull requests: Read and Write".`,
    patCreateUrl: 'https://github.com/settings/personal-access-tokens/new',
    patCreateLink: 'Open GitHub PAT settings',
    patStored: 'A token is stored on this device only.',
    patNotStored: 'No token stored.',
    probeSuccess: 'Token accepted.',
    probeFailScope: 'Token rejected — check the required scope above.',
    clearedMessage: 'Token cleared from this device.',
  },
  errors: {
    noPrParam: 'No ?pr=<number> in the URL. Ask for the navigator link from the PR body.',
    notAuthenticated:
      'A GitHub token is required to submit feedback directly. Open settings to configure one, or use "Copy feedback for PR" to paste it as a PR comment yourself.',
    credentialRejected: 'Credential rejected by GitHub. Open settings and re-check your token.',
    prNotFound: 'Pull request not found or your token cannot see it.',
    rateLimit: 'GitHub rate limit hit — try again later.',
    network: 'Network error — your draft is safe. Retry when connection returns.',
    noFeatureFolder:
      'No feature folder (specs/NNN-*) was touched by this pull request. Nothing to review.',
    serverValidation: 'GitHub rejected the submission (422). Try again or contact the maintainer.',
    unknown: 'Something went wrong.',
    submitEmpty: 'Add at least one comment before submitting.',
  },
  artifactView: {
    cannotPreview: 'Cannot preview this file type.',
    imageLarge: 'This file is unusually large — rendering may be slow.',
  },
  errorBanner: {
    retry: 'Retry',
  },
  openPrList: {
    heading: 'Did you mean one of these open pull requests?',
    loading: 'Looking up open pull requests…',
    empty: `No open pull requests on ${DEFAULT_REPO_LABEL}.`,
    failed: 'Could not load the list of open pull requests.',
  },
  specBrowser: {
    openButton: 'Browse open PRs',
    modalTitle: `Open pull requests on ${DEFAULT_REPO_LABEL}`,
    closeButton: 'Close',
    authRequired: 'A GitHub token is required to list open pull requests. Open settings first.',
  },
  readOnlyHint: {
    message:
      'Read-only mode: reads use GitHub\'s public API (60 requests/hr per IP). Configure a token in settings to submit feedback directly and raise the limit.',
  },
} as const;
