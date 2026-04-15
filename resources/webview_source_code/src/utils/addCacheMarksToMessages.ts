import { cloneDeep, findLastIndex, isEqual } from "lodash";
import { ChatMessage } from "../services";
import { Tool } from "../store/workspace";

export default function addCacheMarksToMessages(messages: ChatMessage[]): ChatMessage[] {
  const sendMessages = cloneDeep(messages);
  const lastIndex = sendMessages.length - 1;
  const lastMessage = sendMessages[lastIndex];
  if (lastMessage.role === 'user') {
    lastMessage.content = typeof lastMessage.content === "string"
      ? [
        {
          type: "text",
          text: lastMessage.content,
          cache_control: {
            type: "ephemeral",
          },
        },
      ]
      : lastMessage.content.map((content, contentIndex) =>
        contentIndex === lastMessage.content.length - 1
          ? {
            ...content,
            cache_control: {
              type: "ephemeral",
            },
          }
          : content
      ) as any
  } else if (lastMessage.role === 'tool') {
    const secondLastMessage = sendMessages[lastIndex - 1];
    if (secondLastMessage.role === 'assistant' && secondLastMessage.tool_calls) {
      secondLastMessage.tool_calls = secondLastMessage.tool_calls.map((toolCall) => ({
        ...toolCall,
        cache_control: {
          type: "ephemeral",
        },
      }));
      lastMessage.cache_control = {
        type: "ephemeral",
      }
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