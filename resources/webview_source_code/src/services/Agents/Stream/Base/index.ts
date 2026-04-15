import { createParser, EventSourceParseCallback, ParsedEvent } from "eventsource-parser";
import { logger as webToolsLogger, hub as webToolsHub } from '@dep305/codemaker-web-tools';
import { IBaseStream, IStreamContext, IStreamOption } from "./Interface";
import { UserEvent } from "../../../../types/report";
import { useAuthStore } from "../../../../store/auth";
import { useExtensionStore } from "../../../../store/extension";
import userReporter from "../../../../utils/report";
import { REQUEST_TIMEOUT_NAME, useChatStore } from "../../../../store/chat";
import { useChatConfig } from "../../../../store/chat-config";
import { StreamError } from "../../../useChatStream";


export default abstract class BaseStream implements IBaseStream {
  protected _needContinue = true // 继续传输流
  protected pingpongTimer: NodeJS.Timeout | undefined
  public options: IStreamOption

  public get getUrl() {
    return ''
  }

  public get getMaxTimeout() {
    return 1000 * 60 * 1
  }

  private abortController: AbortController | undefined


  public requestParmas: Record<string, any> = {}
  public convesationContext: IStreamContext = {
    content: ''
  } // 记录回流的上下文

  constructor(reqParmas: Record<string, any>, options: IStreamOption) {
    this.reset()
    this.requestParmas = reqParmas
    this.options = options
    this.connect()
  }

  public async connect() {
    try {
      const url = this.getUrl
      // 在真正使用 URL 时进行检查
      if (!url) {
        throw new Error('请补充url')
      }
      this.options?.onController?.(this.abortController as AbortController)
      const request = new Request(
        url,
        {
          method: 'POST',
          headers: this.getRequestHeader(),
          body: JSON.stringify(this.requestParmas),
          signal: this.abortController?.signal,
        }
      )
      this.handleSteamTimeout()
      const res = new Response(
        await this.createStream(request)
      );
      if (res.ok) {
        this.onStream(res)
      } else {
        this.options?.onError?.(new Error('Stream Error'));
      }
    } catch (error) {
      console.error(error)
      this.options?.onError?.(error as Error)
    }
  }

  public handleSteamTimeout() {
    if (this.pingpongTimer) {
      clearTimeout(this.pingpongTimer)
    }
    this.pingpongTimer = setTimeout(
      () =>
        this.abortController?.abort({
          name: REQUEST_TIMEOUT_NAME,
          message: StreamError.Timeout,
        }),
      this.getMaxTimeout,
    )
  }

  public getRequestHeader() {
    const { accessToken, username } = useAuthStore.getState()
    const { codeMakerVersion, IDE } = useExtensionStore.getState()

    let departmentCode = '';
    try {
      departmentCode = encodeURI(
        useAuthStore.getState().authExtends.department_code,
      );
    } catch (error) {
      console.error(error);
    }
    const codeGenerateModelCode = useExtensionStore.getState().generateModelCode;
    const entrance = useExtensionStore.getState().entrance;
    return {
      'Content-Type': 'application/json',
      'X-Access-Token': accessToken as string,
      'X-Auth-User': encodeURI(username as string || ''),
      'y3maker-version': codeMakerVersion as string,
      ide: IDE as string,
      'department-code': departmentCode as string,
      'code-generate-model-code': codeGenerateModelCode as string,
      entrance: entrance as string,
    };
  }

  public async createStream(req: Request): Promise<ReadableStream | null> {
    const res = await fetch(req);
    const isSuccess = await this.onValidate(res);

    if (!isSuccess || !res.body) {
      this.close();
      return null;
    }

    // 直接返回响应的 body 流，不需要重新创建流
    // 流的解析逻辑统一在 onStream 方法中处理
    return res.body;
  }

  public async onValidate(res: Response) {
    if (res.ok) return true
    return false
  }

  /**
   * @name 解析流
   * @param event
   * @param options 由于闭包上下文访问原因，options需要透传
   * @returns
   */
  public onParse(event: ParsedEvent) {
    if (event.type !== 'event') return;

    const eData = event.data;
    try {
      const parsedData = JSON.parse(eData);
      switch (parsedData.event) {
        case 'error': {
          const eData = typeof parsedData.error === 'object' ? parsedData.error : {}
          try {
            console.log('错误信息', parsedData.error)
            this.options?.onMessage(eData?.message || '小助手出现点问题，建议同学重新提问~~')
          } catch (error) {
            this.options?.onMessage("未知错误")
          }
          userReporter.report({
            event: UserEvent.REPLY_EXCEPTION,
            extends: {
              message: '未知错误',
              ...eData
            },
          });
          this.close();
          break
        }
        case 'message': {
          this.convesationContext['content'] += parsedData.answer
          this.options?.onMessage(this.convesationContext['content'])
          break
        }
        default: break
      }
    } catch (error) {
      console.error('JSON parsing error:', error);
      return;
    }
  }

  public async onStream(res: Response) {
    if (!res.body) {
      this.options?.onError?.(new Error('响应体为空'));
      return;
    }
    clearTimeout(this.pingpongTimer);

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    const parser = createParser(((evnet: ParsedEvent) => this.onParse(evnet)) as EventSourceParseCallback);
    try {
      while (this._needContinue) {
        const { done, value } = await reader.read();
        // 检查流是否结束
        if (done) {
          this._needContinue = false;
          break;
        }
        // 解码并送入解析器
        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }
    } finally {
      // 确保释放 reader
      try {
        reader.releaseLock();
      } catch (e) {
        // reader 可能已经被释放
      }
      this.close();
    }
  }

  public onError(error: Error) {
    const model = useChatConfig.getState().config.model;
    userReporter.report({
      event: UserEvent.REPLY_EXCEPTION,
      extends: {
        model: this.requestParmas?.model || 'unknow',
        session_id: this.options,
        error_message: error.message,
      },
    });
    webToolsHub.withScope((scope) => {
      scope.setExtras({
        event: UserEvent.REPLY_EXCEPTION,
        model,
        session_id: useChatStore().currentSessionId,
        error_message: error.message,
        mark: 3,
      });
      webToolsLogger.captureException(error);
    });
    this.options?.onError?.(error);
  }


  public close() {
    try {
      this._needContinue = false; // 停止流读取
      this.abortController?.abort?.();
      if (this.pingpongTimer) {
        clearTimeout(this.pingpongTimer);
        this.pingpongTimer = undefined;
      }
    } finally {
      //
    }
  }

  public reset() {
    this._needContinue = true
    this.abortController = new AbortController()
    clearTimeout(this.pingpongTimer)
    this.convesationContext = {
      content: '',
    }
  }
}
