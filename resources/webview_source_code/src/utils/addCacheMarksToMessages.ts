import { cloneDeep, findLastIndex, isEqual } from "lodash";
import { ChatMessage, ChatMessageContent } from "../services";
import { Tool } from "../store/workspace";

export default function addCacheMarksToMessages(messages: ChatMessage[]): ChatMessage[] {
  const sendMessages = cloneDeep(messages);

  // Breakpoints 1-3: 标记 system message 的各 content block
  const systemMessage = sendMessages.find(m => m.role === 'system');
  if (systemMessage && Array.isArray(systemMessage.content)) {
    for (const block of systemMessage.content) {
      if (block.type === 'text') {
        (block as any).cache_control = { type: "ephemeral" };
      }
    }
  }

  // Breakpoint 4: 标记最后一条 user/tool 消息
  const lastIndex = sendMessages.length - 1;
  const lastMessage = sendMessages[lastIndex];
  if (lastMessage.role === 'user') {
    if (typeof lastMessage.content === "string") {
      lastMessage.content = [
        {
          type: ChatMessageContent.Text,
          text: lastMessage.content,
          cache_control: {
            type: "ephemeral",
          },
        },
      ];
    } else {
      const len = lastMessage.content.length;
      lastMessage.content = lastMessage.content.map((content: any, contentIndex: number) =>
        contentIndex === len - 1
          ? {
            ...content,
            cache_control: {
              type: "ephemeral",
            },
          }
          : content
      ) as any;
    }
  } else if (lastMessage.role === 'tool') {
    // 统一处理串行/并行: 向前查找对应的 assistant 消息
    let i = lastIndex - 1;
    while (i >= 0 && sendMessages[i].role === 'tool') i--;
    const assistantMessage = sendMessages[i];
    if (assistantMessage?.role === 'assistant' && assistantMessage.tool_calls) {
      // BP4: 标记最后一个 tool_call（AIGW 当前唯一识别的 tool 侧缓存位置）
      const tcs = assistantMessage.tool_calls;
      tcs[tcs.length - 1] = {
        ...tcs[tcs.length - 1],
        cache_control: {
          type: "ephemeral",
        },
      } as any;
    }
  }

  return sendMessages;
}

let lastMessages: ChatMessage[] = [];
let lastCacheMessageId = '';
let lastTools: Tool[] = [];

export function checkReusable(options: {
  messages: ChatMessage[];
  tools: Tool[];
}) {
  const {
    messages,
    tools
  } = options;
  const cloneMessages = cloneDeep(messages);
  const thisTimeMessages = cloneMessages.map((message) => {
    return {
      id: message.id,
      content: message.content,
      role: message.role
    }
  });
  const thisTools = cloneDeep(tools);
  const thisTimeCacheIndex = findLastIndex(cloneMessages, (message) => message.cache_control?.type === 'ephemeral');
  if (thisTimeCacheIndex !== -1) {
    if (lastCacheMessageId) {
      const lastTimeCacheIndex = findLastIndex(thisTimeMessages, (message) => message.id === lastCacheMessageId);
      if (lastTimeCacheIndex === -1) {
        console.log('prompt cache: 上次缓存消息不存在, 无法命中缓存');
      } else if (!isEqual(thisTimeMessages.slice(0, lastTimeCacheIndex + 1), lastMessages)) {
        console.log(thisTimeMessages.slice(0, lastTimeCacheIndex + 1));
        console.log(lastMessages);
        for (let i = 0; i < thisTimeMessages.slice(0, lastTimeCacheIndex + 1).length; i++) {
          if (!isEqual(thisTimeMessages.slice(0, lastTimeCacheIndex + 1)[i], lastMessages[i])) {
            console.log('prompt cache: 第' + i + '条消息不匹配, 无法命中缓存');
          }
        }
        console.log('prompt cache: messages 不匹配, 无法命中缓存');
      } else if (!isEqual(thisTools, lastTools)) {
        console.log('prompt cache: tools 不匹配, 无法命中缓存');
      } else {
        console.log('prompt cache: 前缀匹配，可命中缓存');
      }
    }
    lastCacheMessageId = cloneMessages[thisTimeCacheIndex].id || '';
    lastMessages = thisTimeMessages.slice(0, thisTimeCacheIndex + 1);
    lastTools = thisTools;
  } else {
    console.log('prompt cache: 本次未设置缓存标记');
  }
}