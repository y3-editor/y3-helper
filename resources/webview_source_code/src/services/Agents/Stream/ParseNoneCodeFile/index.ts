import { ParsedEvent } from "eventsource-parser";
import { IParseNoneCodeFileContext, IParseNoneCodeFileStream } from "./Interface";
import BaseStream from "../Base";
import userReporter from "../../../../utils/report";
import { UserEvent } from "../../../../types/report";
import { IStreamOption } from "../Base/Interface";


export default class ParseNoneCodeFileStream extends BaseStream implements IParseNoneCodeFileStream {
  public requestParmas: Record<string, any> = {}
  public convesationContext: IParseNoneCodeFileContext = {
    content: ''
  } // 记录回流的上下文

  public get getUrl() {
    // return `/proxy/bm/apps/d163153e-9724-424e-80f9-a375af37cb26/chat` // 测试环境
    return `/proxy/bm/apps/00000000-0000-0000-0000-000000000004/chat`
  }

  public get getMaxTimeout() {
    return 1000 * 60 * 2
  }

  constructor(fileUrl: string, options: IStreamOption) {
    super({
      // flowId: "d163153e-9724-424e-80f9-a375af37cb26",
      flowId: "00000000-0000-0000-0000-000000000004",
      inputs: {},
      mode: "workflow",
      input_files: {
        file: fileUrl
      },
    }, options)
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
          userReporter.report({
            event: UserEvent.REPLY_EXCEPTION,
            extends: {
              message: '未知错误',
              ...eData
            },
          });
          this.options.onError?.(new Error(eData.message || '未知错误'))
          this.close();
          break
        }
        case 'workflow_started': {
          this.options?.onMessage(this.convesationContext['content'])
          break
        }
        case 'workflow_finished': {
          this.convesationContext['content'] += (parsedData?.data?.outputs?.result || '')
          this.options?.onMessage(this.convesationContext['content'])
          requestAnimationFrame(() => {
            this.options?.onFinish?.('')
          })
          break
        }
        default: break
      }
    } catch (error) {
      console.error('JSON parsing error:', error);
      return;
    }
  }

}
