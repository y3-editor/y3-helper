import * as React from 'react';
import { useChatConfig } from '../../../../store/chat-config';
import { useAuthStore } from '../../../../store/auth';
import { useConfigStore } from '../../../../store/config';
import {
  ChatModelType,
  IChatModelConfig,
} from '../../../../services/chatModel';
import ModelPicker, { resolveModelCodeByUseModel } from '../ModelPicker';

export const INHERIT_VALUE = '';

export const EXPLORE_RECOMMENDED_MODELS = [
  'MiniMax-M2.7',
  'MiniMax-M2.5',
  'glm-5',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-6',
  'kimi-k2.5',
  'gpt-4o-mini-2024-07-18',
];

/**
 * explore agent 模型黑名单（按 code / useModel 匹配）
 * 列表中的模型不会出现在 explore 的模型选择器中。
 */
export const EXPLORE_BLOCKED_MODELS: string[] = [
  // 在此添加需要屏蔽的模型 code / useModel，例如：
  'claude-opus-4-5-20251101',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'gpt-5.5-2026-04-24',
  'gpt-5.4-pro-2026-03-05',
  'Gemini-3.1-Pro-AAA',
  'gemini-3.1-pro-customtools',
  'gemini-3.1-pro',
];

export function isThinkingModel(config: IChatModelConfig | undefined): boolean {
  if (!config) return false;
  return (
    config.hasThinking === true ||
    (!!config.title && config.title.toLowerCase().includes('thinking'))
  );
}

/** 按 supplyChannel（厂商）排序，再按 displayOrder 二级排序 */
export function sortByVendor(models: IChatModelConfig[]): IChatModelConfig[] {
  return [...models].sort((a, b) => {
    const vendorA = a.supplyChannel || '';
    const vendorB = b.supplyChannel || '';
    if (vendorA !== vendorB) return vendorA.localeCompare(vendorB);
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });
}

interface AgentModelPickerProps {
  agentName: string;
  agentDefaultModel?: string;
  isDark: boolean;
}

const AgentModelPicker: React.FC<AgentModelPickerProps> = ({
  agentName,
  isDark,
}) => {
  const chatModels = useChatConfig((state) => state.chatModels);
  const subagentModelConfig = useChatConfig(
    (state) => state.subagentModelConfig,
  );
  const setSubagentModelConfig = useChatConfig(
    (state) => state.setSubagentModelConfig,
  );
  const username = useAuthStore((state) => state.username);
  const authExtends = useAuthStore((state) => state.authExtends);
  const codeChatModelsSetting =
    useConfigStore.getState().config.codeChatModelsSetting;

  const selectedModel = subagentModelConfig?.[agentName] || INHERIT_VALUE;

  const displayModels = React.useMemo(() => {
    let filtered = Object.values(chatModels)
      .filter((config) => {
        if (!config?.enabled) return false;
        if (
          ![ChatModelType.CODEBASE, ChatModelType.ALL].includes(config.chatType)
        )
          return false;
        const { authInfo } = config;
        if (authInfo?.allowAll) return true;
        if (authInfo?.allowedUsers?.includes(username || '')) return true;
        if (
          authInfo?.allowedDepartments?.includes(authExtends.department || '')
        )
          return true;
        return false;
      })
      .filter((config) => {
        const title = config.title || '';
        if (!Object.prototype.hasOwnProperty.call(codeChatModelsSetting, title))
          return true;
        return codeChatModelsSetting[title] !== false;
      });

    // explore 与 general 统一：只过滤 Thinking 模型，不再用白名单限制
    // 例外：supplyChannel 为 Deepseek 的 thinking 模型仍可显示
    if (agentName === 'explore' || agentName === 'general') {
      filtered = filtered.filter(
        (config) =>
          !isThinkingModel(config) || config.supplyChannel === 'Deepseek',
      );
    }

    // explore 黑名单过滤：移除不允许选择的模型
    if (agentName === 'explore' && EXPLORE_BLOCKED_MODELS.length > 0) {
      const blockedSet = new Set(EXPLORE_BLOCKED_MODELS);
      filtered = filtered.filter(
        (config) =>
          !blockedSet.has(config.code || '') &&
          !blockedSet.has(config.useModel || ''),
      );
    }

    return sortByVendor(filtered);
  }, [chatModels, username, authExtends, codeChatModelsSetting, agentName]);

  const notRecommendedWarning = React.useMemo<string | undefined>(() => {
    if (!selectedModel) return undefined;
    const selectedModelCode = resolveModelCodeByUseModel(
      selectedModel,
      chatModels,
    );
    const modelTitle = chatModels[selectedModelCode]?.title || selectedModel;

    // explore 和 general 统一：所选为 Thinking 模型时警告（Deepseek 除外）
    if (
      agentName === 'explore' &&
      isThinkingModel(chatModels[selectedModelCode]) &&
      chatModels[selectedModelCode]?.supplyChannel !== 'Deepseek'
    ) {
      return `所选模型 ${modelTitle} 不再推荐用于此 agent`;
    }
    if (
      agentName === 'general' &&
      isThinkingModel(chatModels[selectedModelCode]) &&
      chatModels[selectedModelCode]?.supplyChannel !== 'Deepseek'
    ) {
      return `所选模型 ${modelTitle} 不再推荐用于此 agent`;
    }
    return undefined;
  }, [selectedModel, agentName, chatModels]);

  return (
    <ModelPicker
      isDark={isDark}
      value={selectedModel}
      onChange={(value) =>
        setSubagentModelConfig(agentName, value || INHERIT_VALUE)
      }
      displayModels={displayModels}
      chatModels={chatModels}
      recommendedModels={
        agentName === 'explore' ? EXPLORE_RECOMMENDED_MODELS : undefined
      }
      notRecommendedWarning={notRecommendedWarning}
      inheritLabel={
        agentName === 'explore'
          ? '默认（Claude 4.5 Haiku）'
          : '默认（跟随全局）'
      }
      inheritButtonText={
        agentName === 'explore'
          ? '默认（Claude 4.5 Haiku）'
          : '默认（跟随全局）'
      }
    />
  );
};

export default AgentModelPicker;