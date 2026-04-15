import * as React from 'react';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from '../PostMessageProvider';
import { useEditorFileState } from '../store/editor';

export default function EditorProvider() {
  const { postMessage } = usePostMessage();
  const update = useEditorFileState((state) => state.update);

  React.useEffect(() => {
    postMessage({
      type: BroadcastActions.GET_EDITOR_FILE_STATE,
    });
  }, [postMessage]);

  React.useEffect(
    function EditorEventHandler() {
      function handleMessage(event: MessageEvent<PostMessageSubscribeType>) {
        if (event.data.type !== SubscribeActions.EDITOR_FILE_STATE) {
          return;
        }
        const { data } = event.data;
        update(data as any);
      }

      // 监听 postMessage 消息
      window.addEventListener('message', handleMessage);

      return () => {
        // 移除消息监听器
        window.removeEventListener('message', handleMessage);
      };
    },
    [postMessage, update],
  );

  return null;
}
