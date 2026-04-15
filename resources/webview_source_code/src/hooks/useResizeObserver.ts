import * as React from 'react';

interface Rect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
}

export default function useResizeObserver(): [
  (node: HTMLElement | null) => void,
  Rect,
] {
  const [rect, setRect] = React.useState<Rect>({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
  });
  // https://reactjs.org/docs/hooks-faq.html#how-can-i-measure-a-dom-node

  const [resizeObserver] = React.useState(
    () =>
      new ResizeObserver(([entry]) => {
        // https://github.com/souporserious/react-measure/pull/118
        requestAnimationFrame(() => {
          setRect(entry.contentRect);
        });
      }),
  );

  const ref = React.useCallback(
    (node: HTMLElement | null) => {
      if (node === null) return;
      resizeObserver.disconnect();
      resizeObserver.observe(node);
    },
    [resizeObserver],
  );

  return [ref, rect];
}
