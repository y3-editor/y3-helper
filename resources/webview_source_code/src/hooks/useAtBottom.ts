import * as React from 'react';

export function useAtBottom(ref: React.RefObject<HTMLElement>, offset = 0) {
  const [isAtBottom, setIsAtBottom] = React.useState(false);

  React.useLayoutEffect(() => {
    const containter = ref.current;

    const handleScroll = () => {
      if (containter) {
        const isBottom =
          containter.scrollTop + containter.clientHeight ===
          containter.scrollHeight;
        setIsAtBottom(isBottom);
      }
    };

    if (containter) {
      containter.addEventListener('scroll', handleScroll, { passive: true });
    }
    handleScroll();

    return () => {
      containter?.removeEventListener('scroll', handleScroll);
    };
  }, [offset, ref]);

  const scrollToBottom = React.useCallback(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [ref]);

  return [isAtBottom, scrollToBottom] as const;
}
