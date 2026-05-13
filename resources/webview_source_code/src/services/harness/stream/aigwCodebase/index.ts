import BaseStream from "../base";
import { ParsedEvent } from "eventsource-parser";
import { getErrorMessage } from "../../../../utils";
import { IAigwCodebaseStream, IAigwCodebaseStreamContext } from "./interface";
import { IStreamOption } from "../base/interface";


export default class AigwCodebase extends BaseStream implements IAigwCodebaseStream {
  public requestParmas: Record<string, any> = {}
  public conversationContext: IAigwCodebaseStreamContext = {
    content: '',
    tool_calls: [],
  } // 记录回流的上下文

  public get getUrl() {
    return `/proxy/gpt/gpt/codebase_chat_stream/CodeChat.codebase`
  }

  public get getMaxTimeout() {
    return 1000 * 60 * 2
  }

  constructor(data: any, options: IStreamOption) {
    super(data, options)
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
    console.log('==eData==', eData)

    if (eData?.trim?.() === '[DONE]') {
      requestAnimationFrame(() => {
        this.options?.onFinish?.(this.conversationContext['content'])
        this.close()
      })
    }

    try {
      const parsedData = JSON.parse(eData);
      if (parsedData?.choices && Array.isArray(parsedData.choices)) {
        for (const choice of parsedData.choices) {
          if (choice?.delta?.content) {
            this.conversationContext['content'] += choice?.delta?.content || ''
            this.conversationContext['tool_calls'] += choice?.delta?.tool_calls || ''
          }
        }
      }
      this.options?.onMessage?.(this.conversationContext['content'])
    } catch (error) {
      this.options?.onError?.(new Error(getErrorMessage(error)));
      this.close()
    }
  }

}