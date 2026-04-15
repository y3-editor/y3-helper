import { useEffect, useState, useRef, useCallback } from 'react';

function useThrottle<T>(value: T, delay: number): [T, () => void] {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());
  const pendingValue = useRef<T | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    // 清除待处理的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // 清空待处理的值
    pendingValue.current = null;
    
    // 重置时间戳，让下次调用可以立即执行
    lastExecuted.current = 0;
    
    // 立即设置当前值
    setThrottledValue(value);
  }, [value]);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecuted = now - lastExecuted.current;

    if (timeSinceLastExecuted >= delay) {
      // 如果距离上次执行已经超过延迟时间，立即执行
      setThrottledValue(value);
      lastExecuted.current = now;
      pendingValue.current = null;
      
      // 清除可能存在的待处理定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // 保存待处理的值
      pendingValue.current = value;
      
      // 如果还没有设置定时器，设置一个
      if (!timeoutRef.current) {
        const remainingTime = delay - timeSinceLastExecuted;
        timeoutRef.current = setTimeout(() => {
          // 使用最新的待处理值
          if (pendingValue.current !== null) {
            setThrottledValue(pendingValue.current);
            lastExecuted.current = Date.now();
            pendingValue.current = null;
          }
          timeoutRef.current = null;
        }, remainingTime);
      }
    }

    // 清理函数
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay]);

  // 组件卸载时的最终清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [throttledValue, reset];
}

export default useThrottle;