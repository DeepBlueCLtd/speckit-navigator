import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import { SelectionAnchor } from '../SelectionAnchor';
import type { SelectionContext } from '../../types';

const SOURCE = 'The quick brown fox jumps over the lazy dog and runs home today.';

function Harness(props: {
  onAddSelectionComment: (s: SelectionContext) => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref} data-testid="source-container">
        {SOURCE}
      </div>
      <SelectionAnchor
        source={SOURCE}
        containerRef={ref}
        onAddSelectionComment={props.onAddSelectionComment}
      />
    </div>
  );
}

describe('SelectionAnchor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom does not implement Range.getBoundingClientRect — stub to a fixed box.
    const proto = Range.prototype as unknown as {
      getBoundingClientRect?: () => DOMRect;
    };
    if (!proto.getBoundingClientRect) {
      const stubRect: DOMRect = {
        top: 10,
        bottom: 20,
        left: 30,
        right: 40,
        width: 10,
        height: 10,
        x: 30,
        y: 10,
        toJSON: () => ({}),
      };
      proto.getBoundingClientRect = () => stubRect;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    window.getSelection()?.removeAllRanges();
  });

  it('does not render a chip when there is no active selection', () => {
    render(<Harness onAddSelectionComment={() => {}} />);
    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('selection-add-chip')).toBeNull();
  });

  it('shows a chip after a non-empty selection inside the container', () => {
    render(<Harness onAddSelectionComment={() => {}} />);
    const container = screen.getByTestId('source-container');
    const textNode = container.firstChild!;

    const range = document.createRange();
    const start = SOURCE.indexOf('brown fox');
    const end = start + 'brown fox'.length;
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
      vi.advanceTimersByTime(200);
    });

    const chip = screen.getByTestId('selection-add-chip');
    expect(chip).toBeTruthy();
  });

  it('click on the chip emits the captured selection context', () => {
    const onAddSelectionComment = vi.fn<(s: SelectionContext) => void>();
    render(<Harness onAddSelectionComment={onAddSelectionComment} />);
    const container = screen.getByTestId('source-container');
    const textNode = container.firstChild!;

    const range = document.createRange();
    const start = SOURCE.indexOf('brown fox');
    const end = start + 'brown fox'.length;
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
      vi.advanceTimersByTime(200);
    });

    const chip = screen.getByTestId('selection-add-chip');
    act(() => {
      chip.click();
    });

    expect(onAddSelectionComment).toHaveBeenCalledOnce();
    const captured = onAddSelectionComment.mock.calls[0][0];
    // The DOM→source offset translation is heuristic (word-boundary search
    // across the walker result), so the captured snippet may shift by up to
    // one whitespace char at boundaries. Contract is that "brown fox" is
    // present and the anchor-hash round-trips.
    expect(captured.snippet.trim()).toBe('brown fox');
    expect(captured.contextAfter.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-control-regex
    expect(captured.anchorHash).toMatch(/^.+\u001F.+\u001F\d+$/);
  });

  it('ignores a selection whose endpoints fall outside the container', () => {
    const onAddSelectionComment = vi.fn<(s: SelectionContext) => void>();
    render(
      <div>
        <Harness onAddSelectionComment={onAddSelectionComment} />
        <p data-testid="outside">unrelated external paragraph text here</p>
      </div>,
    );
    const outside = screen.getByTestId('outside');
    const textNode = outside.firstChild!;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByTestId('selection-add-chip')).toBeNull();
    expect(onAddSelectionComment).not.toHaveBeenCalled();
  });
});
