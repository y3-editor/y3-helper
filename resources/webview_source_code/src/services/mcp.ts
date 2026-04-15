import axios from 'axios';
import { setDefaultHeaders } from '.';
import { handleError } from './error';
import { BuiltInServer } from '../store/mcp';
import { BroadcastActions, PostMessageSubscribeType, SubscribeActions } from '../PostMessageProvider';
import { nanoid } from 'nanoid';
import { GetPromptResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { ListPromptsResult, GetPromptResult, PromptMessage } from '@modelcontextprotocol/sdk/types.js';

// 创建专门用于 MCP 服务的 axios 实例
export const mcpApiRequest = axios.create({
  baseURL: '/proxy/mcp/api',
  timeout: 100000,
  headers: {},
});

mcpApiRequest.interceptors.request.use(setDefaultHeaders);
mcpApiRequest.interceptors.response.use(undefined, handleError);

// 从接口获取内置服务器数据的函数
export const fetchBuiltInServers = async (): Promise<BuiltInServer[]> => {
  // try {
  //   // 使用专门的 MCP API 实例，baseURL 已经设置为 '/proxy/mcp/api'
  //   const response = await mcpApiRequest.get('/servers/tags/codemaker');
  //   return response.data;
  // } catch (error) {
  //   console.error('获取内置服务器列表失败:', error);
  //   // 如果接口调用失败，返回空数组
  //   return [];
  // }
  return [];
};

// 获取名字映射关系
export const fetchNameMappings = async (): Promise<any[]> => {
  // try {
  //   const response = await mcpApiRequest.get('/servers?limit=-1&_field=id,name,chinese_name');
  //   return response.data.items;
  // } catch (error) {
  //   console.error('获取名字映射关系失败:', error);
  //   return [];
  // }
  return [];
}



// 从接口获取内置服务器数据的函数
export const fetchPrivateModelOnlyServers = async (): Promise<BuiltInServer[]> => {
  // try {
  //   // 使用专门的 MCP API 实例，baseURL 已经设置为 '/proxy/mcp/api'
  //   const response = await mcpApiRequest.get('/servers/tags/private-model-only');
  //   return response.data;
  // } catch (error) {
  //   console.error('获取内置服务器列表失败:', error);
  //   // 如果接口调用失败，返回空数组
  //   return [];
  // }
  return [];
};

// MCP Prompt 类型
export type McpPrompt = ListPromptsResult["prompts"][number];
export type McpPromptResult = GetPromptResult;
export type McpPromptMessage = PromptMessage;

// 通过插件侧透传 prompts/get
export async function getMcpPrompt(
  params: {
    serverName: string;
    promptName: string;
    arguments?: Record<string, unknown>;
  },
  timeoutMs = 60000,
): Promise<McpPromptResult> {
  const requestId = nanoid();

  // 过滤 undefined/null 参数
  const cleanArgs = params.arguments
    ? Object.fromEntries(
        Object.entries(params.arguments).filter(([, v]) => v !== undefined && v !== null),
      )
    : undefined;

  const payload = {
    serverName: params.serverName,
    promptName: params.promptName,
    arguments: cleanArgs,
    requestId,
  };

  return new Promise<McpPromptResult>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<PostMessageSubscribeType>) => {
      const message = event.data as {
        type: string;
        data?: {
          requestId: string;
          prompt?: McpPromptResult;
          error?: string;
        }
      };
      if (!message || !message.type) return;

      if (
        message.type === SubscribeActions.GET_MCP_PROMPT_SUCCESS &&
        message.data?.requestId === requestId
      ) {
        try {
          const prompt = message.data?.prompt;
          const parsed = GetPromptResultSchema.safeParse(prompt);
          if (parsed.success) {
            resolve(parsed.data);
          } else {
            resolve(prompt as McpPromptResult);
          }
        } catch (err) {
          reject(err as Error);
        } finally {
          cleanup();
        }
      }

      if (
        message.type === SubscribeActions.GET_MCP_PROMPT_ERROR &&
        message.data?.requestId === requestId
      ) {
        cleanup();
        reject(new Error(message.data?.error || 'GET_MCP_PROMPT_ERROR'));
      }
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('GET_MCP_PROMPT timeout'));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    };

    window.addEventListener('message', handleMessage);

    window.parent.postMessage(
      {
        type: BroadcastActions.GET_MCP_PROMPT,
        data: payload,
      },
      '*',
    );
  });
}
