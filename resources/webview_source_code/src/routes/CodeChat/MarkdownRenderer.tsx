import { useEffect, useRef, useState } from 'react';
import styles from './index.module.scss';
import { ThemeStyle, useTheme } from '../../ThemeContext';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import useCustomToast from '../../hooks/useCustomToast';
import useThrottle from '../../hooks/useThrottle';

const MarkdownRenderer = ({ content }: any) => {
  const [parsedContent, setParsedContent] = useState('');
  const [isRenderingPaused, setIsRenderingPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { activeTheme } = useTheme();
  const { postMessage } = usePostMessage();
  const { toast } = useCustomToast();
  const workerRef = useRef<any>(null);
  const requestIdRef = useRef<number>(0);
  const lastProcessedIdRef = useRef<number>(0); // 记录最后处理的请求ID
  const prevContentRef = useRef<string>(content);

  // 使用节流优化频繁更新，保持流式输出的流畅感
  const [throttledContent, resetThrottle] = useThrottle(content, 50);
  
  // 检测内容是否被重置（比如切换对话）
  useEffect(() => {
    const currentContent = content || '';
    const prevContent = prevContentRef.current || '';

    const isContentReset = currentContent.length < prevContent.length;
    
    if (isContentReset) {
      setParsedContent('');
      // 重置节流状态
      resetThrottle();
      // 重置解析状态
      requestIdRef.current = 0;
      lastProcessedIdRef.current = 0;
    }
    
    prevContentRef.current = content;
  }, [content, resetThrottle]);
  
  useEffect(() => {
    const worker = new Worker(new URL('./markdownWorker.js', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event) => {
      const { requestId, content: parsedHtml } = event.data;
      
      // 只处理比上次处理的ID更新的请求（顺序判断）
      if (requestId > lastProcessedIdRef.current) {
        setParsedContent(parsedHtml);
        lastProcessedIdRef.current = requestId;
      }
      // 忽略过期的响应，但不会报错或警告
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isRenderingPaused) return;

    if (workerRef.current && throttledContent) {
      // 生成新的请求ID
      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;
      
      // 发送带有请求ID的消息
      workerRef.current.postMessage({ 
        content: throttledContent, 
        requestId: currentRequestId 
      });
    }
  }, [throttledContent, isRenderingPaused]);

  useEffect(() => {
    const container: any = containerRef.current;
    if (!container) return;

    const copyHandler = async (event: any) => {
      if (event.target.classList.contains('copy-button')) {
        setIsRenderingPaused(true);

        const button = event.target;
        const codeText = decodeURIComponent(button.getAttribute('data-code'));

        await postMessage({
          type: BroadcastActions.COPY_TO_CLIPBOARD,
          data: codeText,
        });
        toast({
          title: `复制成功。 `,
          status: 'success',
          position: 'top',
          isClosable: true,
        });

        setIsRenderingPaused(false);
      }
    };

    const mouseEnterHandler = (event: any) => {
      if (event.target.classList.contains('copy-button')) {
        setIsRenderingPaused(true);
      }
    };

    const mouseLeaveHandler = (event: any) => {
      if (event.target.classList.contains('copy-button')) {
        setIsRenderingPaused(false);
      }
    };

    container.addEventListener('click', copyHandler, true);
    container.addEventListener('mouseenter', mouseEnterHandler, true);
    container.addEventListener('mouseleave', mouseLeaveHandler, true);

    return () => {
      container.removeEventListener('click', copyHandler, true);
      container.removeEventListener('mouseenter', mouseEnterHandler, true);
      container.removeEventListener('mouseleave', mouseLeaveHandler, true);
    };
  }, [postMessage, toast]);

  return (
    <div
      ref={containerRef}
      className={`${styles.markdownRenderer} ${activeTheme === ThemeStyle.Light ? styles.lightMarkdownRenderer : styles.darkMarkdownRenderer}`}
    >
      <div dangerouslySetInnerHTML={{ __html: parsedContent }} />
    </div>
  );
};

export default MarkdownRenderer;