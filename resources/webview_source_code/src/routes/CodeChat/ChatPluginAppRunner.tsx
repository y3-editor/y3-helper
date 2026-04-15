import * as React from 'react';
import { Tag, TagCloseButton, TagLabel } from '@chakra-ui/react';
import { usePluginApp } from '../../store/plugin-app';
import { useChatStreamStore } from '../../store/chat';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from '../../PostMessageProvider';
import { PluginActionStatus, PluginRecieveData } from '../../services/plugin';

const DETECT_INTERVAL = 10 * 1000;
const HEARTBEAT_INTERVAL = 30 * 1000;

function ChatPluginAppRunner() {
  const { postMessage } = usePostMessage();
  const runner = usePluginApp((state) => state.runner);
  const update = usePluginApp((state) => state.update);
  const [runnerTask, handlePluginAppDone, handlePluginAppStop] =
    useChatStreamStore((state) => [
      state.runnerTask,
      state.onPluginAppDone,
      state.onPluginAppStop,
    ]);

  const latestCheckerRef = React.useRef<number>(Date.now());
  const runnerTimerRef = React.useRef<number>();

  React.useEffect(
    function heartbeatChecker() {
      if (runnerTask) {
        latestCheckerRef.current = Date.now();
        runnerTimerRef.current = window.setInterval(() => {
          const now = Date.now();
          // 超时未返回心跳信息，表示可能 IDE 挂掉了，可以触发停止
          if (now - latestCheckerRef.current > HEARTBEAT_INTERVAL) {
            handlePluginAppStop();
            return;
          }
          postMessage({
            type: BroadcastActions.PLUGIN_APP_CHECK_STATUS,
            data: {
              task_id: runnerTask.id,
            },
          });
        }, DETECT_INTERVAL);
      } else {
        clearInterval(runnerTimerRef.current);
      }

      function handlePluginAppCheck(
        event: MessageEvent<PostMessageSubscribeType>,
      ) {
        const rawData = event.data;
        if (rawData.type === SubscribeActions.PLUGIN_APP_STATUS) {
          const data = rawData.data as unknown as PluginRecieveData;
          switch (data.status) {
            case PluginActionStatus.SUCCESS:
            case PluginActionStatus.FAILED:
            case PluginActionStatus.ABORTED:
            case PluginActionStatus.NOT_FOUND: {
              clearInterval(runnerTimerRef.current);
              handlePluginAppDone(data);
              break;
            }
            case PluginActionStatus.IN_PROGRESS: {
              latestCheckerRef.current = Date.now();
              break;
            }
            default:
              break;
          }
        }
      }

      window.addEventListener('message', handlePluginAppCheck);
      return () => {
        window.removeEventListener('message', handlePluginAppCheck);
      };
    },
    [handlePluginAppDone, handlePluginAppStop, postMessage, runnerTask],
  );

  if (!runner) {
    return null;
  }

  return (
    <div className="mb-2">
      <Tag
        variant="solid"
        size="md"
        px={2}
        py={1}
        key={runner._id}
        // backgroundColor="transparent"
        fontSize="12px"
      >
        <TagLabel isTruncated>/ {runner.app_shortcut.name}</TagLabel>
        <TagCloseButton onClick={() => update(undefined)} />
      </Tag>
    </div>
  );
}

export default ChatPluginAppRunner;
