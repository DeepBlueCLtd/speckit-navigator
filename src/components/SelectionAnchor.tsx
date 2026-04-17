import { useEffect, useMemo, useRef, useState } from 'react';
import { strings } from '../strings';
import { captureSelection } from '../format/selectionAnchor';
import type { SelectionContext } from '../types';

interface Props {
  source: string;
  containerRef: React.RefObject<HTMLElement>;
  onAddSelectionComment: (selection: SelectionContext) => void;
}

interface ChipState {
  top: number;
  left: number;
  start: number;
  end: number;
}

/**
 * Compute the offset within `source` of a DOM text node offset.
 * We use a simple traversal that concatenates textContent of descendants
 * in document order; markdown rendered by react-markdown preserves enough
 * visible text to find a unique match for most reasonable selections.
 */
function findSourceOffset(
  container: HTMLElement,
  node: Node,
  nodeOffset: number,
  source: string,
): number | null {
  const texts: string[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let current: Node | null = walker.nextNode();
  let preText = '';
  while (current) {
    if (current === node) {
      preText += (current.textContent ?? '').slice(0, nodeOffset);
      break;
    }
    preText += current.textContent ?? '';
    current = walker.nextNode();
  }
  texts.push(preText);
  const idx = source.indexOf(preText.trim().slice(-80));
  if (idx < 0 || preText.length < 3) {
    // Fall back: find by the text content at selection node
    const raw = (node.textContent ?? '').slice(0, nodeOffset);
    const nearby = raw.slice(Math.max(0, raw.length - 80));
    if (nearby.length === 0) return null;
    const i = source.indexOf(nearby);
    return i < 0 ? null : i + nearby.length;
  }
  return idx + preText.trim().slice(-80).length;
}

export function SelectionAnchor({
  source,
  containerRef,
  onAddSelectionComment,
}: Props): JSX.Element | null {
  const [chip, setChip] = useState<ChipState | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    function onSelectionChange(): void {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setChip(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const container = containerRef.current;
        if (!container) {
          setChip(null);
          return;
        }
        if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
          setChip(null);
          return;
        }
        const text = sel.toString();
        if (text.trim().length === 0) {
          setChip(null);
          return;
        }
        const startOffset = findSourceOffset(
          container,
          range.startContainer,
          range.startOffset,
          source,
        );
        const endOffset = findSourceOffset(
          container,
          range.endContainer,
          range.endOffset,
          source,
        );
        if (startOffset === null || endOffset === null || endOffset <= startOffset) {
          // Fallback: locate the selected string in the source directly.
          const sourceIdx = source.indexOf(text);
          if (sourceIdx < 0) {
            setChip(null);
            return;
          }
          const rect = range.getBoundingClientRect();
          setChip({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
            start: sourceIdx,
            end: sourceIdx + text.length,
          });
          return;
        }
        const rect = range.getBoundingClientRect();
        setChip({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          start: startOffset,
          end: endOffset,
        });
      }, 150);
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [source, containerRef]);

  const handleClick = useMemo(
    () => (): void => {
      if (!chip) return;
      const cap = captureSelection(source, chip.start, chip.end);
      onAddSelectionComment(cap);
      setChip(null);
      window.getSelection()?.removeAllRanges();
    },
    [chip, source, onAddSelectionComment],
  );

  if (!chip) return null;

  return (
    <button
      type="button"
      className="selection-chip"
      style={{ top: chip.top, left: chip.left }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick();
      }}
      data-testid="selection-add-chip"
    >
      {strings.buttons.commentSelection}
    </button>
  );
}
