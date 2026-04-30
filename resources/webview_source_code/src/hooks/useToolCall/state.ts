/**
 * 工具调用状态管理逻辑
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChatMessage } from '../../services';
import { ToolCallState } from './types';

export function useToolCallState(message: ChatMessage): ToolCallState {
  const [toolResponse, setToolResponse] = useState<{
    [propName: string]: boolean;
  }>({});

  const [unselectedResults, setUnselectedResults] = useState<Set<string>>(
    new Set(),
  );

  // 初始化工具响应状态
  useEffect(() => {
    if (message.tool_calls) {
      const response: {
        [propName: string]: boolean;
      } = message.response
          ? {
            ...message.response,
          }
          : {};
      for (const tool of message.tool_calls) {
        if (response[tool.id] !== false) {
          response[tool.id] = true;
        }
      }
      setToolResponse(response);
    }
  }, [message.response, message.tool_calls]);

  // 处理选择变化
  const handleSelectionChange = useCallback((
    id: string,
    isSelected: boolean,
    toolId: string,
  ) => {
    setUnselectedResults((prev) => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }

      // 找到对应工具的所有结果
      const currentTool = message.tool_calls?.find(
        (tool) => tool.id === toolId,
      );
      if (currentTool) {
        const toolCallResults = message.tool_result || {};
        const result = toolCallResults[toolId] || {};

        try {
          const retrievedResults: any[] = [];
          if (currentTool.function.name === 'retrieve_code' && (result as any).content) {
            const searchResult = JSON.parse((result as any).content);
            searchResult.forEach((item: any, index: number) => {
              // 添加主函数结果
              retrievedResults.push({
                id:
                  (item.func_name
                    ? item.func_name.split('\n').slice(-1)[0]
                    : '') + index,
              });

              // 添加to_func子函数结果
              if (item.to_func) {
                item.to_func.forEach(() => {
                  retrievedResults.push({
                    id:
                      (item.func_name
                        ? item.func_name.split('\n').slice(-1)[0]
                        : '') + index,
                  });
                });
              }
            });
          } else if (currentTool.function.name === 'retrieve_knowledge' && (result as any).content) {
            const searchResult = JSON.parse((result as any).content);
            searchResult.forEach((item: any, index: number) => {
              retrievedResults.push({
                id: item.attributes.filename + index,
              });
            });
          }

          // 更新toolResponse状态
          const nextToolResponse = { ...toolResponse };

          if (retrievedResults.length > 0) {
            // 如果所有结果都被取消选择，将工具响应设置为false
            if (newSet.size === retrievedResults.length) {
              nextToolResponse[toolId] = false;
            } else if (newSet.size < retrievedResults.length) {
              // 只要有结果被选中，就将工具响应设置为true
              nextToolResponse[toolId] = true;
            }
          }

          setToolResponse(nextToolResponse);
        } catch (e) {
          console.warn('处理检索结果出错:', e);
        }
      }

      return newSet;
    });
  }, [message.tool_calls, message.tool_result, toolResponse]);

  // 计算工具响应是否禁用
  const toolResponseDisabled = useMemo(() => {
    if (!message.tool_calls || !message.tool_calls.length) {
      return true;
    }
    return (
      Object.keys(message.response || {}).length === message.tool_calls.length
    );
  }, [message.response, message.tool_calls]);

  // 判断是否有工具调用错误
  const hasToolCallError = useMemo(() => {
    if (!message.tool_result) {
      return false;
    }
    return Object.values(message.tool_result).some((result) => result.isError);
  }, [message.tool_result]);

  // 计算路径列表
  const pathList = useMemo(() => {
    const pathList: any = [];
    message.tool_calls?.map((tool) => {
      const result = toolResponse[tool.id];
      if (result) {
        const toolCallResults = message.tool_result || {};
        const result = toolCallResults[tool.id] || {};
        if ((result as any).path) {
          pathList.push((result as any).path);
        }
      }
    });
    return pathList;
  }, [message.tool_calls, message.tool_result, toolResponse]);

  return {
    toolResponse,
    unselectedResults,
    toolResponseDisabled,
    hasToolCallError,
    pathList,
    setToolResponse,
    setUnselectedResults,
    handleSelectionChange,
  };
}