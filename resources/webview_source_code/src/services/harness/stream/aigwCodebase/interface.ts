import { ToolCall } from "../../..";



export abstract class IAigwCodebaseStream {
}

export interface IAigwCodebaseStreamContext {
  content: string
  tool_calls: ToolCall[]
}