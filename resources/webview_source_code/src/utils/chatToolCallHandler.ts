import { ToolCall } from "../services";
import { ChatSession } from "../store/chat";

export const onMessageToolCallResponse = (
  session: ChatSession,
  content: string,
  done: boolean,
  toolCalls: ToolCall[],
  totalTokens: number,
  completionTokens: number) => {


  console.debug('onMessageToolCallResponse', {
    content,
    done,
    toolCalls,
    totalTokens,
    completionTokens
  });
  if (toolCalls.find(toolCall => toolCall.function.name === 'make_plan') && session.data) {
    session.data.planModeState = 'draft';
  }
}
