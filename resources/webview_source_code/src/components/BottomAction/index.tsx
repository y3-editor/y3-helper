import { useEffect, useMemo } from 'react';
import styles from './index.module.css';
import useCustomToast from '../../hooks/useCustomToast';
interface Prop {
  className?: string;
  loading: boolean;
  onStop: () => void;
  position?: 'relative' | 'fixed';
  tab: 'chat' | 'review' | 'search';
  notFixed?: boolean;
}

const loadingText = {
  chat: '回复中...',
  review: 'review中...',
  search: '搜索中...',
};

export default function BottomActions(props: Prop) {
  const { onStop, loading, className, tab, notFixed } = props;

  const { toast } = useCustomToast();

  const handlePostMessage = useMemo(() => {
    return (event: MessageEvent) => {
      const message = event.data;
      const { data, type } = message;
      switch (type) {
        case 'actionError':
          toast({
            title: `请求失败：${data.content}`,
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'top',
          });
          break;
        case 'actionInfo':
          toast({
            title: data.content,
            status: 'info',
            duration: 3000,
            isClosable: true,
            position: 'top',
          });
          break;
        case 'actionSuccess':
          toast({
            title: data.content,
            status: 'success',
            duration: 1000,
            isClosable: true,
            position: 'top',
          });
          break;
        case 'actionMessageClear':
          break;
      }
    };
  }, [toast]);

  useEffect(() => {
    window.addEventListener('message', handlePostMessage);
    return () => {
      window.removeEventListener('message', handlePostMessage);
    };
  }, [handlePostMessage]);

  if (notFixed && !loading) {
    return null;
  }

  return (
    <>
      <div
        className={`w-full h-8 flex-shrink-0 ${className} relative`}
        style={{ position: loading ? 'sticky' : 'relative' }}
      >
        {loading ? (
          <div className={`${styles['actions-wrapper']} gap-4 z-[1]`}>
            <span onClick={onStop}>中止</span>
          </div>
        ) : null}
        {loading && (
          <div className="flex items-center p-[8px] absolute top-0 w-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={16}
              height={16}
              style={{
                fill: '#cccccc',
                opacity: 0.5,
              }}
              className="loading-simple"
              viewBox="0 0 1024 1024"
            >
              <path d="M512 1024A512 512 0 010 512a48 48 0 0196 0A416 416 0 10512 96a48 48 0 010-96 512 512 0 010 1024z"></path>
            </svg>
            <span className="mr-1 opacity-50">{loadingText[tab]}</span>
          </div>
        )}
      </div>
    </>
  );
}
