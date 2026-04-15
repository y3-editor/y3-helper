import { useEffect, useRef } from 'react';
import { useMCPStore } from '../store/mcp';
import { ChatModel } from '../services/chatModel';

interface UseMCPModelRestrictionProps {
  selectedModel: ChatModel;
  chatType: string;
  privateModels: ChatModel[];
}

/**
 * 管理 MCP 服务器的模型限制
 * 当使用商用模型时，禁用标记为 'private-model-only' 的 MCP 服务器
 */
export const useMCPModelRestriction = ({
  selectedModel,
  chatType,
  privateModels,
}: UseMCPModelRestrictionProps) => {
  const prevModelRef = useRef<{ model: ChatModel; chatType: string } | null>(null);
  const privateModelOnlyServers = useMCPStore((state) => state.PrivateModelOnlyServers);

  useEffect(() => {
    // 如果 PrivateModelOnlyServers 还没加载，等待加载
    if (privateModelOnlyServers.length === 0) {
      return;
    }

    const setDisabledSwitches = useMCPStore.getState().setDisabledSwitches;
    const clearDisabledSwitches = useMCPStore.getState().clearDisabledSwitches;

    // 检查当前模型类型
    const currentModelIsPrivate = privateModels.includes(selectedModel);
    const isPublicModel = !currentModelIsPrivate;


    // 检查是否是模型切换
    const isPreviousModelPrivate = prevModelRef.current
      ? privateModels.includes(prevModelRef.current.model)
      : null;
    const isModelSwitched =
      prevModelRef.current &&
      (prevModelRef.current.model !== selectedModel ||
        prevModelRef.current.chatType !== chatType);

    // 更新 ref
    prevModelRef.current = { model: selectedModel, chatType };

    // 情况1: 初始化时是私有模型 - 不做任何操作
    if (currentModelIsPrivate) {
      clearDisabledSwitches();
      return;
    }

    // 情况2: 初始化时是商用模型 - 禁用 private-model-only 的 Switch
    if (isPublicModel && chatType === 'codebase') {
      if (privateModelOnlyServers.length > 0) {
        // 设置需要禁用的 Switch，传入服务器名称
        setDisabledSwitches(privateModelOnlyServers.map((s) => s.name));
      }
      return;
    }

    // 情况3: 从商用切换到私有 - 解除 Switch 限制（不发送 postMessage）
    if (isModelSwitched && isPreviousModelPrivate === false && currentModelIsPrivate) {
      console.log('情况3: 从商用切换到私有 - 解除 Switch 限制');
      clearDisabledSwitches();
      return;
    }

    // 情况4: 从私有切换到商用 - 禁用 private-model-only 的 Switch
    if (isModelSwitched && isPreviousModelPrivate === true && isPublicModel && chatType === 'codebase') {
      console.log('情况4: 从私有切换到商用 - 禁用 Switch');

      if (privateModelOnlyServers.length > 0) {
        // 设置需要禁用的 Switch，传入服务器名称
        setDisabledSwitches(privateModelOnlyServers.map((s) => s.name));
      }
      return;
    }

    // 其他情况：chatType 变化等
    if (isModelSwitched && chatType === 'codebase' && isPublicModel) {
      console.log('其他情况: chatType 变化 - 可能需要禁用 Switch');

      if (privateModelOnlyServers.length > 0) {
        setDisabledSwitches(privateModelOnlyServers.map((s) => s.name));
      }
    } else if (isModelSwitched) {
      // 其他切换情况，清除禁用状态
      clearDisabledSwitches();
    }
  }, [selectedModel, chatType, privateModelOnlyServers, privateModels]);
};
