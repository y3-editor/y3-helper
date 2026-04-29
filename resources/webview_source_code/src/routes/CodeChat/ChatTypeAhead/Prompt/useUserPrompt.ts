import * as React from 'react';
import {
  BroadcastActions,
  usePostMessage,
} from '../../../../PostMessageProvider';
import useService, { mutateService } from '../../../../hooks/useService';
import {
  MASK_LABEL,
  Prompt,
  PromptCategoryType,
  createPrompt,
  getProjectPrompts,
  getSystemPrompts,
  getUserPrompts,
  removePrompt,
  updatePrompt,
} from '../../../../services/prompt';
import { toastErrorMessage } from '../../../../utils';
import { toastUserPromptCategoryWithoutInit } from '../../../../utils/toast';
import useCustomToast from '../../../../hooks/useCustomToast';
import {
  extensionStore,
  IDE,
  useExtensionStore,
} from '../../../../store/extension';
import { getPlugins } from '../../../../services/plugin';
import { useUserConfig } from '../../../../store/user-config';
import { useMaskStore } from '../../../../store/mask';
import { UserEvent } from '../../../../types/report';
import { useChatStore } from '../../../../store/chat';
import { CODEWIKI_STRUCTURE_PROMBT } from './CodeWiki/BasicPrompt';
import { versionCompare } from '../../../../utils/common';

export enum PrePrompt {
  Explain = 'EXPLAIN',
  FindProblem = 'FIND_PROBLEM',
  Optimize = 'OPTIMIZE',
  UnitTest = 'UNIT_TEST',
}

// eslint-disable-next-line react-refresh/only-export-components
export const prePromptEventMap = new Map([
  [PrePrompt.Explain, UserEvent.CODE_CHAT_PROMPT_EXPLAIN],
  [PrePrompt.FindProblem, UserEvent.CODE_CHAT_PROMPT_FIND_PROBLEM],
  [PrePrompt.Optimize, UserEvent.CODE_CHAT_PROMPT_OPTIMIZE],
  [PrePrompt.UnitTest, UserEvent.CODE_CHAT_UNIT_TEST],
]);

export const prePromptIdsMap = new Map([
  [PrePrompt.Optimize, '64cca6b00d40da33d799ef50'],
  [PrePrompt.Explain, '64cca63a0d40da33d799ef4e'],
  [PrePrompt.FindProblem, '64cca6970d40da33d799ef4f'],
  [PrePrompt.UnitTest, '663c3aeec65c317f6eb1529d'],
]);

// 定义的三个通用的 prompt，见：https://prompt.nie.netease.com/category/64cca5a50d40da33d799ef4d
export const prePromptEventIdsMap = new Map([
  ['64cca6b00d40da33d799ef50', UserEvent.CODE_CHAT_PROMPT_OPTIMIZE],
  ['64cca63a0d40da33d799ef4e', UserEvent.CODE_CHAT_PROMPT_EXPLAIN],
  ['64cca6970d40da33d799ef4f', UserEvent.CODE_CHAT_PROMPT_FIND_PROBLEM],
  ['663c3aeec65c317f6eb1529d', UserEvent.CODE_CHAT_UNIT_TEST],
]);

export const PROMPT_CODE_VARIABLE = '{{%code%}}';

export enum CommonVariable {
  Code = 'code',
  Knowledge = 'knowledge',
  File = 'file',
  Codebase = 'codebase',
}

export enum InnerVariable {
  __DATETIME__ = '__DATETIME__',
  __USER__ = '__USER__',
}

export function getVariableSlotDisplay(variable: string) {
  return `{{%${variable}%}}`;
}

export const INNER_VARIABLE: { [key in InnerVariable]: string } = (
  Object.keys(InnerVariable) as Array<keyof typeof InnerVariable>
).reduce(
  (
    acc: { [key in InnerVariable]: string },
    key: keyof typeof InnerVariable,
  ) => {
    acc[InnerVariable[key]] = getVariableSlotDisplay(InnerVariable[key]);
    return acc;
  },
  {} as { [key in InnerVariable]: string },
);

export const COMMON_VARIABLE: { [key in CommonVariable]: string } = (
  Object.keys(CommonVariable) as Array<keyof typeof CommonVariable>
).reduce(
  (
    acc: { [key in CommonVariable]: string },
    key: keyof typeof CommonVariable,
  ) => {
    acc[CommonVariable[key]] = getVariableSlotDisplay(CommonVariable[key]);
    return acc;
  },
  {} as { [key in CommonVariable]: string },
);

const PROJECT_PROMPT_MANAGE_URL = 'https://g.126.fm/02Fh8tA';


// 1. /Codewiki 调试Rules：基于Codewiki Rules生成可预览的文件目录
// 3. /Codewiki 本地生成Codewiki在本地创建codewiki目录，生成完整wiki内容 。只要触发/codewiki就使用这份规则。

function formatPromptCategory({
  systemPrompts,
  projectPrompts,
  userPrompts,
  ide,
  isCodebaseChat = false,
}: {
  systemPrompts: Prompt[] | undefined;
  projectPrompts: Prompt[] | undefined;
  userPrompts: Prompt[] | undefined;
  ide: string | undefined | null;
  isCodebaseChat?: boolean;
}) {
  const isVsCodeIDE = ide === IDE.VisualStudioCode;
  const _prompts: Prompt[] = [];
  // 系统级别 prompt
  for (const prompt of systemPrompts || []) {
    if (prompt.name && !prompt.name.includes('CodeMap')) {
      _prompts.push({ ...prompt, type: PromptCategoryType._CodeMaker });
    }
  }

  // CodeWiki 配置生成专家 - 只在仓库智聊下显示
  if (isCodebaseChat && (isVsCodeIDE) && versionCompare('2.9.9', useExtensionStore.getState().codeMakerVersion || '') >= 0) {
    _prompts.push({
      name: 'CodeWiki Rule生成',
      prompt: CODEWIKI_STRUCTURE_PROMBT,
      _id: 'codewiki_generate',
      // codewiki_debugger
      type: PromptCategoryType.CodeWiki,
      description: '一键基于当前代码仓库生成Codewiki 规则Json文件',
    });

    // _prompts.push({
    //   name: 'CodeWiki 本地生成Codewiki',
    //   prompt: CODEWIKI_GENERATOR_PROMPT,
    //   _id: 'codewiki_preview_docs',
    //   type: PromptCategoryType.CodeWiki,
    //   description: '在本地创建codewiki目录，生成完整wiki内容',
    // });
  }

  // 项目级别 prompt
  for (const prompt of projectPrompts || []) {
    if (prompt.labels?.includes(MASK_LABEL)) {
      continue;
    }
    _prompts.push({ ...prompt, type: PromptCategoryType.Project });
  }
  // 用户级别 prompt
  for (const prompt of userPrompts || []) {
    if (prompt.labels?.includes(MASK_LABEL)) {
      continue;
    }
    _prompts.push({ ...prompt, type: PromptCategoryType.User });
  }
  return _prompts;
}

export async function getLatestPrompts(isCodebaseChat = false) {
  const ide = extensionStore.getState().IDE;
  const [systemPrompts, projectPrompts, userPrompts] = await Promise.all([
    getSystemPrompts(),
    getProjectPrompts(),
    getUserPrompts(),
  ]);

  return formatPromptCategory({
    systemPrompts,
    projectPrompts,
    userPrompts,
    ide,
    isCodebaseChat,
  });
}

function useUserPrompt() {
  const { postMessage } = usePostMessage();

  const [prompts, setPrompts] = React.useState<Prompt[]>([]);
  const subscribedApps = useUserConfig(
    (state) => state.config?.subscribe_app_tools,
  );
  const userCategoryId = useMaskStore((state) => state.config.categoryId);
  const ide = useExtensionStore((state) => state.IDE);

  // 获取当前会话类型，判断是否为仓库智聊
  const currentSession = useChatStore((state) => state.currentSession());
  const isCodebaseChat = currentSession?.chat_type === 'codebase';

  // 判断是否是 VSCode IDE 的提示，仅在 VSCode IDE 上生效
  const isVsCodeIDE = ide === IDE.VisualStudioCode;

  const { data: systemPrompts, isLoading: isLoadingSystemPrompts } = useService(
    getSystemPrompts,
    [],
  );
  const { data: projectPrompts, isLoading: isLoadingProjectPrompts } =
    useService(getProjectPrompts, []);
  const { data: userPrompts, isLoading: isLoadingUserPrompts } = useService(
    getUserPrompts,
    [],
    {
      revalidateOnFocus: true,
    },
  );
  const { data: pluginApps, isLoading: isLoadingPluginPrompts } = useService(
    getPlugins,
    isVsCodeIDE ? [] : null,
  );

  const loading =
    isLoadingSystemPrompts &&
    isLoadingProjectPrompts &&
    isLoadingUserPrompts &&
    isLoadingPluginPrompts;

  React.useEffect(() => {
    const _prompts: Prompt[] = formatPromptCategory({
      systemPrompts,
      projectPrompts,
      userPrompts,
      ide,
      isCodebaseChat,
    });
    setPrompts(_prompts);
  }, [ide, projectPrompts, systemPrompts, userPrompts, isCodebaseChat]);

  const shortcuts = React.useMemo(() => {
    const _shortcuts = [];
    // 插件级别 prompt
    for (const plugin of pluginApps || []) {
      if (!subscribedApps?.includes(plugin._id)) {
        continue;
      }
      for (const shortcut of plugin.app_shortcuts || []) {
        _shortcuts.push(shortcut);
      }
    }
    return _shortcuts;
  }, [subscribedApps, pluginApps]);

  const { toast } = useCustomToast();

  const handleOpenProjectPromptManageWebsite = () => {
    postMessage({
      type: BroadcastActions.OPEN_IN_BROWSER,
      data: { url: PROJECT_PROMPT_MANAGE_URL },
    });
  };

  const handleCreatePrompt = async (name: string, prompt: string) => {
    if (!userCategoryId) {
      toastUserPromptCategoryWithoutInit();
      return;
    }
    try {
      await createPrompt(userCategoryId, name, prompt);
      toast({
        title: `用户 prompt 创建成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getUserPrompts);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  const handleUpdatePrompt = async (
    prompt_id: string,
    name: string,
    prompt: string,
  ) => {
    if (!userCategoryId) {
      toastUserPromptCategoryWithoutInit();
      return;
    }
    try {
      await updatePrompt(userCategoryId, prompt_id, name, prompt);
      toast({
        title: `用户 prompt 更新成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getUserPrompts);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  const handleRemovePrompt = async (id: string) => {
    if (!userCategoryId) {
      toastUserPromptCategoryWithoutInit();
      return;
    }
    try {
      await removePrompt(userCategoryId, id);
      toast({
        title: `用户 prompt 删除成功。 `,
        status: 'success',
        position: 'top',
        isClosable: true,
      });
      mutateService(getUserPrompts);
    } catch (error) {
      console.error(error);
      toast({
        title: toastErrorMessage(error as Error),
        status: 'error',
        position: 'top',
        isClosable: true,
      });
    }
  };

  return {
    loading,
    prompts,
    shortcuts,
    pluginApps,
    handleOpenProjectPromptManageWebsite,
    handleCreatePrompt,
    handleUpdatePrompt,
    handleRemovePrompt,
  };
}

export default useUserPrompt;