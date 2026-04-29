import { DEFAULT_ASSISTANT_MESSAGE, useChatStore, useChatStreamStore } from "../store/chat";
import { UserEvent } from "../types/report";
import EventBus, { EBusEvent } from "./eventbus";
import {
  logger as webToolsLogger,
  hub as webToolsHub,
} from '@dep305/codemaker-web-tools';

export const httpErrorType: Record<string | number, string> = {
  413: '当前提问的上下文过大，请缩小范围后再提问',
  429: '请求太频繁啦，请稍后在发起请求',
  500: '服务有异常，请联系Codemaker值班',
  403: '请重新登陆后再访问CodemaKer',
  404: '暂时找不到服务，请联系Codemaker值班',
  unknown: '检测到服务有波动,请稍后重试或联系Codemaker值班',
}


// 流式错误处理
export class ChatStreamErrorMgr {
  private static _ins: ChatStreamErrorMgr
  public static get instance(): ChatStreamErrorMgr {
    if (!this._ins) this._ins = new ChatStreamErrorMgr();
    return this._ins
  }

  // 检查请求流的异常
  public checkStreamExceptionFromService({
    messageId,
    sessionId,
    ntesTraceId,
    error,
  }: {
    messageId: string,
    sessionId: string,
    ntesTraceId?: string
    error: Error
  }) {
    let errorData: any
    try {
      errorData = JSON.parse(error?.message)
    } catch (e) { /* empty */ }
    if (errorData?.error) {
      // toastError(errorData?.content || message)
      const { syncHistory, updateCurrentSession } = useChatStore.getState()

      updateCurrentSession((session) => {
        session.data?.messages.push({
          ...DEFAULT_ASSISTANT_MESSAGE,
          id: messageId,
          content: errorData?.content || '-',
          group_tokens: (errorData?.content || '-').length * 2,
        })
      })
      requestAnimationFrame(syncHistory)
      if (errorData.error === 'quotaExceeded') {
        EventBus.instance.dispatch(EBusEvent.Update_User_Quota)
      } else {
        webToolsHub.withScope((scope) => {
          scope.setExtras({
            event: UserEvent.CODE_CHAT_REQUEST_EXCEPTION,
            session_id: sessionId,
            error_status: errorData?.error,
            ntesTraceId: ntesTraceId,
            mark: 6,
            chatType: 'codebase',
          });
          webToolsLogger.captureException(error);
        });
      }
      useChatStreamStore.getState().reset()
      return true
    }
    return false
  }
}
