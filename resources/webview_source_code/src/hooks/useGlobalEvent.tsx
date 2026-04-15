import { useEffect, useCallback, useRef, useState } from "react";
import EventBus, { EBusEvent } from "../utils/eventbus";
import useCustomToast from "./useCustomToast";
import { useChatStore } from "../store/chat";
import { ChatRole } from "../types/chat";


export function useGlobalEvent() {
  const { toast, closeAll } = useCustomToast()
  const currentSession = useChatStore((state) => state.currentSession());
  const onNewSession = useChatStore((state) => state.onNewSession);
  const hasClickRef = useRef(false);
  const [loading, setLoading] = useState(false);


  const onCreateNewSession = useCallback(async() => {
    try {
      if (hasClickRef.current) return
      setLoading(true)
      hasClickRef.current = true
      // 找到会话中排在中间的user消息
      const originalMessages = currentSession?.data?.messages || []
      const curMessage = originalMessages.filter((item) => item.role === ChatRole.User)
      if (!curMessage) {
        return
      }
      const middleIndex = Math.floor(curMessage.length / 2)
      const middleMessage = curMessage[middleIndex]
      if (middleMessage) {
        toast({
          description: '正在保存会话中...',
          status: 'loading',
          duration: null, // 不自动关闭
          isClosable: false,
          position: 'top',
        });
        const startIndex = originalMessages.findIndex((item) => item.id === middleMessage.id)
        const newMessages = originalMessages.slice(startIndex)
        await onNewSession(newMessages)
        closeAll()
        toast({
          description: (
            <div className="flex items-center gap-2">
              <span>当前会话历史消息过多，会话保存失败，已自动新建会话并保留后半部分对话记录</span>
            </div>
          ),
          status: 'info',
          duration: 6000,
          isClosable: true,
          position: 'top',
        })
      }
    } catch(e) {
      closeAll()
      toast({
        description: '当前会话历史消息过多，会话保存失败',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    } finally {
      hasClickRef.current = false
      setLoading(false)
    }
  }, [closeAll, currentSession?.data?.messages, onNewSession, toast])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // const debounceOnCreateNewSession = useMemo(debounce(onCreateNewSession, 1000), [onCreateNewSession]);


  useEffect(() => {
    const onExceedSessionLength = () => {
      onCreateNewSession()
    }
    EventBus.instance.on(EBusEvent.Exceed_Session_Length, onExceedSessionLength)
    return () => {
      return EventBus.instance.off(EBusEvent.Exceed_Session_Length, onExceedSessionLength)
    }
  }, [loading, onCreateNewSession, toast])

}
