import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentComposer } from '../CommentComposer';
import { COMMENT_TAGS, type CommentDraft, type SelectionContext } from '../../types';

const SELECTION: SelectionContext = {
  snippet: 'selected passage',
  contextBefore: 'before ',
  contextAfter: ' after',
  anchorHash: 'selected passage\u001Fselected passage\u001F42',
};

describe('CommentComposer', () => {
  it('renders feature-level title and exposes all 5 tags plus "No tag"', () => {
    render(
      <CommentComposer level="feature" onSave={() => {}} onCancel={() => {}} />,
    );
    const select = screen.getByTestId('composer-tag') as HTMLSelectElement;
    expect(select.options.length).toBe(COMMENT_TAGS.length + 1);
    expect(select.options[0].value).toBe('');
    const tagValues = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(tagValues).toEqual([...COMMENT_TAGS]);
  });

  it('renders document-level with the path shown', () => {
    render(
      <CommentComposer
        level="document"
        path="specs/191-spec-navigator/spec.md"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('specs/191-spec-navigator/spec.md')).toBeTruthy();
  });

  it('renders selection-level with the snippet quoted', () => {
    render(
      <CommentComposer
        level="selection"
        path="specs/191-spec-navigator/spec.md"
        selection={SELECTION}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('selected passage')).toBeTruthy();
  });

  it('does not call onSave when body is empty; shows empty-body error once touched', () => {
    const onSave = vi.fn();
    render(<CommentComposer level="feature" onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Please enter some feedback/)).toBeTruthy();
  });

  it('calls onSave with the feature-level draft shape when saved with body + tag', () => {
    const onSave = vi.fn<(draft: CommentDraft) => void>();
    render(<CommentComposer level="feature" onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId('composer-body'), {
      target: { value: 'A thought' },
    });
    fireEvent.change(screen.getByTestId('composer-tag'), {
      target: { value: 'blocker' },
    });
    fireEvent.click(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledOnce();
    const arg = onSave.mock.calls[0][0];
    expect(arg).toEqual({ level: 'feature', body: 'A thought', tag: 'blocker' });
  });

  it('calls onSave with the document-level draft shape including path', () => {
    const onSave = vi.fn<(draft: CommentDraft) => void>();
    render(
      <CommentComposer
        level="document"
        path="specs/191-spec-navigator/plan.md"
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('composer-body'), {
      target: { value: 'Plan is tight' },
    });
    fireEvent.click(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toEqual({
      level: 'document',
      path: 'specs/191-spec-navigator/plan.md',
      body: 'Plan is tight',
      tag: undefined,
    });
  });

  it('calls onSave with the selection-level draft shape propagating all anchor fields', () => {
    const onSave = vi.fn<(draft: CommentDraft) => void>();
    render(
      <CommentComposer
        level="selection"
        path="specs/191-spec-navigator/spec.md"
        selection={SELECTION}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('composer-body'), {
      target: { value: 'This sentence needs tightening' },
    });
    fireEvent.click(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledOnce();
    const draft = onSave.mock.calls[0][0];
    expect(draft).toMatchObject({
      level: 'selection',
      path: 'specs/191-spec-navigator/spec.md',
      snippet: SELECTION.snippet,
      contextBefore: SELECTION.contextBefore,
      contextAfter: SELECTION.contextAfter,
      anchorHash: SELECTION.anchorHash,
      body: 'This sentence needs tightening',
    });
  });

  it('prefills body + tag when editing an existing comment', () => {
    const existing = {
      id: '01HW7GX0P0EXAMPLE0000001',
      level: 'feature' as const,
      body: 'Original text',
      tag: 'nit' as const,
    };
    render(
      <CommentComposer
        level="feature"
        editing={existing}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect((screen.getByTestId('composer-body') as HTMLTextAreaElement).value).toBe(
      'Original text',
    );
    expect((screen.getByTestId('composer-tag') as HTMLSelectElement).value).toBe('nit');
  });

  it('invokes onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<CommentComposer level="feature" onSave={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('composer-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
