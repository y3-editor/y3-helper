import { useCallback, useEffect, useRef } from "react";
import { BroadcastActions, usePostMessage } from "../PostMessageProvider";
import { useChatStore } from "../store/chat";

export function useMcpServices() {
  const chatType = useChatStore((state) => state.chatType);
  const resumeTimeRef = useRef(0)
  const { postMessage } = usePostMessage()

  /**
   * 重启所有 MCP 服务
   * 向 VSCode 扩展发送重启命令
   */
  const pingMcpServers = useCallback(async() => {
    if (Date.now() - resumeTimeRef.current < 1000 * 10) return // 10s 内只允许Ping一次
    resumeTimeRef.current = Date.now()
    postMessage({
      type: BroadcastActions.PING_MCP_SERVERS,
    })
  }, [postMessage])

  useEffect(() => {
    if (chatType !== 'codebase') return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pingMcpServers()
      }
    }
    window.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [chatType, pingMcpServers])
}
