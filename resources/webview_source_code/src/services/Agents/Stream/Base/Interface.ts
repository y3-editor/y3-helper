import { ParsedEvent } from "eventsource-parser";


export interface IStreamOption {
  onMessage: (message: string) => void;
  onError?: (error: Error) => void;
  onController?: (controller: AbortController) => void;
  onFinish?: (extra: any) => void;
}


export interface IStreamContext {
  message_id?: string
  reasoningContent?: string
  content: string
  total_tokens?: number
  completion_tokens?: number
}

export abstract class IBaseStream {
  abstract requestParmas: Record<string, any>
  abstract options: IStreamOption
  abstract getMaxTimeout: number
  abstract getUrl: string
  // protected abstract getUrl(): string // 获取请求 URL
  // protected abstract getMaxTimeout(): number // 获取超时时间
  abstract connect(options: IStreamOption): void // 链接流
  abstract getRequestHeader(): HeadersInit // 获取请求流
  abstract handleSteamTimeout(): void // 处理流式超时
  abstract createStream(req: Request): Promise<BodyInit | null> // 创建流
  abstract onValidate(res: Response): Promise<boolean> // 校验流
  abstract onParse(event: ParsedEvent): void // 解析流
  abstract onStream(res: Response): Promise<void> // 传输流
  abstract close(): void // 关闭流
  abstract reset(): void // 重置状态，用于新的请求
}

