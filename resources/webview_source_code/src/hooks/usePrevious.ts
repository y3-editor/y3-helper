import { useRef, useEffect } from 'react';

/**
 * Hook that returns the previous value of a given value
 * @param value - The current value
 * @returns The previous value (undefined on first render)
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  });
  
  return ref.current;
}