import * as React from 'react';
import {
  Flex,
  Grid,
  IconButton,
  Text,
  Tooltip,
  Button,
} from '@chakra-ui/react';
import { TbPlus, TbCube, TbWand } from 'react-icons/tb';
import { LuAirplay, LuBox, LuUser } from 'react-icons/lu';
import { RiStoreFill } from 'react-icons/ri';
import {
  Prompt,
  PromptCategoryType,
  promptCategoryNameMap,
} from '../../../../services/prompt';
import {
  BUILT_IN_PROMPTS,
  BUILT_IN_PROMPTS_SPECKIT,
  getOpenSpecPromptsByVersion,
  BUILT_IN_PROMPTS_OPENSPEC_V023,
  BUILT_IN_PROMPTS_OPENSPEC_V1,
} from '../../../../services/builtInPrompts';
import useUserPrompt from './useUserPrompt';
import PromptList from './PromptList';
import { getListIndex } from '../utils';
import {
  ChatEditPromptModel,
  ChatNewPromptModel,
  ChatNewPromptModelHandle,
  ChatRemovePromptModel,
} from './ChatPromptManageModel';
import { TypeAheadModePrefix, TypeAheadSubProps } from '../const';
import Icon from '../../../../components/Icon';
import { UnionData, UnionType } from './type';
import { useUserConfig } from '../../../../store/user-config';
import { usePluginApp } from '../../../../store/plugin-app';
import { useExtensionStore } from '../../../../store/extension';
import { TypeAheadMode } from '../const';
import {
  PromptSampleFormValue,
  useChatActionStore,
} from '../../../../store/chatAction';
import { usePromptApp } from '../../../../store/promp-app';
import { MERMAID_SIGN, useChatConfig } from '../../../../store/chat-config';
import {
  useChatAttach,
  useChatStore,
  useChatStreamStore,
} from '../../../../store/chat';

import { SpecFramework, useWorkspaceStore } from '../../../../store/workspace';
import { AttachType } from '../../../../store/attaches';
import { useMCPStore } from '../../../../store/mcp';
import { useMcpPromptApp } from '../../../../store/mcp-prompt';
// import { CODEBASE_EXAMPLE } from '../../ChatSamples';
import { checkValueOfPressedKeyboard } from '../../../../utils';
import { supportsOpenSpecVersionSelection } from '../../../../utils/specVersionUtils';
import { McpPrompt } from '../../../../services/mcp';
import { RULES_PROMPT } from '../../../../services/builtInPrompts/rules';
import { createSkillToolId, getSkillSourceLabel, useSkillsStore } from '../../../../store/skills';
import { usePostMessage, BroadcastActions, SubscribeActions } from '../../../../PostMessageProvider';
import { useSkillPromptApp } from '../../../../store/skills/skill-prompt';
import { SKILLS_HUB_API_URL } from '../../../CodeCoverage/const';
import useCustomToast from '../../../../hooks/useCustomToast';
import { usePanelContext } from '../../../../context/PanelContext';

const PROMPT_TYPEHEAD_TRIGGER_PREFIX = '/';

const PromptsPanel = (
  props: TypeAheadSubProps & {
    focusedType: PromptCategoryType | undefined;
    onSubmit: (prompt: Prompt) => void;
    onTypeAheadModeChange: (mode: TypeAheadMode) => void;
  },
) => {
  const {
    inputValue,
    focusIndex,
    userInputRef,
    mentionKeyword,
    updateOpenState,
    focusedType,
    onTypeAheadModeChange,
  } = props;
  const ide = useExtensionStore((state) => state.IDE);
  const codeMakerVersion = useExtensionStore((state) => state.codeMakerVersion);
  const { postMessage, message } = usePostMessage();
  const { toast } = useCustomToast();
  const setCodebaseChatMode = useChatStore((state) => state.setCodebaseChatMode);
  const { panelId: currentPanelId } = usePanelContext();

  const isVscode = ide === 'vscode';
  const [promptType, setPromptType] = React.useState<
    PromptCategoryType | undefined
  >(focusedType || PromptCategoryType._CodeMaker);
  const [isOpenNewPromptModel, setIsOpenNewPromptModel] = React.useState(false);
  const { loading, prompts, pluginApps, handleOpenProjectPromptManageWebsite } =
    useUserPrompt();

  const setCustomPromptSampleCallback = useChatActionStore(
    (state) => state.setCustomPromptSampleCallback,
  );
  const newPromptModelRef = React.useRef<ChatNewPromptModelHandle>(null);

  const userConfig = useUserConfig((state) => state.config);
  const chatConfig = useChatConfig((state) => state.config);
  const chatModels = useChatConfig((state) => state.chatModels);
  const clearSession = useChatStore((state) => state.clearSession);
  const chatType = useChatStore((state) => state.chatType);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );

  const disabled = React.useMemo(() => {
    return isStreaming || isProcessing || isTerminalProcessing;
  }, [isStreaming, isProcessing, isTerminalProcessing]);

  const updatePluginAppRunner = usePluginApp((state) => state.update);
  const updatePromptAppRunner = usePromptApp((state) => state.update);
  const attachs = useChatAttach((state) => state.attachs);
  const updateAttachs = useChatAttach((state) => state.update);
  const MCPServers = useMCPStore((state) => state.MCPServers);
  const skills = useSkillsStore((state) => state.skills);
  const setPendingRunner = useMcpPromptApp((state) => state.setPendingRunner);
  const setSkillLoading = useSkillPromptApp((state) => state.setLoading);
  const hasMcpPrompts = React.useMemo(() => {
    if (!MCPServers?.length) return false;
    return MCPServers.some((server) => (server.prompts?.length ?? 0) > 0);
  }, [MCPServers]);

  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);
  const setOpenspecUpdateModalVisible = useWorkspaceStore(
    (state) => state.setOpenspecUpdateModalVisible
  );

  // 获取 OpenSpec 版本
  const getFrameworkSpecInfo = useWorkspaceStore((state) => state.getFrameworkSpecInfo);
  const openspecFrameworkInfo = getFrameworkSpecInfo(SpecFramework.OpenSpec);
  const installedOpenSpecVersion = openspecFrameworkInfo?.version;

  const isDuringKeywordSearch = React.useMemo(() => {
    if (inputValue === PROMPT_TYPEHEAD_TRIGGER_PREFIX) {
      return false;
    }
    return true;
  }, [inputValue]);

  // 新建会话命令
  const handleNewSessionCommand = React.useCallback(async () => {
    const chatStore = useChatStore.getState();
    const { currentSession, onNewSession } = chatStore;
    const { workspaceInfo } = useWorkspaceStore.getState();

    const session = currentSession();
    const isEmptySession = session?.data?.messages.length === 0;
    const hasWorkspace = !!workspaceInfo.repoName;
    const sessionRepo = session?.chat_repo;
    const isRepoMismatch = sessionRepo && sessionRepo !== workspaceInfo.repoName;

    const shouldShowAlreadyNewToast = isEmptySession && (
      (hasWorkspace && !isRepoMismatch) ||
      (!hasWorkspace && !sessionRepo)
    );

    if (shouldShowAlreadyNewToast) {
      toast({
        title: '当前已是新对话',
        status: 'info'
      });
      return;
    }

    // 其他所有情况都创建新会话
    await onNewSession();
  }, [toast]);

  // 融合了 prompts 和 plugin apps
  const renderPrompts: UnionData[] = React.useMemo(() => {
    const unionData: UnionData[] = [];

    for (const skill of skills) {
      if (skill.userInvocable === false) {
        continue;
      }
      const sourceLabel = getSkillSourceLabel(skill.source);
      unionData.push({
        name: skill.name,
        description: skill.description,
        type: UnionType.Prompt,
        meta: {
          name: skill.name,
          prompt: `/${skill.name}`,
          _id: `/skill/${skill.name}`,
          type: PromptCategoryType.Skill,
          description: skill.description,
        },
        extra: {
          source: sourceLabel,
        },
      });
    }

    if (chatType === 'codebase' && codebaseChatMode === 'openspec') {
      // 根据安装的 OpenSpec 版本动态选择命令集
      const openspecPrompts = getOpenSpecPromptsByVersion(installedOpenSpecVersion);
      const canShowUpdate = supportsOpenSpecVersionSelection(codeMakerVersion, ide);
      for (const builtIn of openspecPrompts) {
        // openspec-update 仅在 Extension 版本满足 Spec 版本选择要求时提供
        if (builtIn.name === 'openspec-update' && !canShowUpdate) continue;
        unionData.push({
          name: builtIn.name,
          description: builtIn.description,
          type: UnionType.Prompt,
          meta: {
            description: builtIn.description,
            name: builtIn.name,
            prompt: builtIn.prompt,
            _id: `/${builtIn.name}`,
            type: PromptCategoryType._CodeMaker,
          },
        });
      }
    }

    if (chatType === 'codebase' && codebaseChatMode === 'speckit') {
      for (const builtIn of BUILT_IN_PROMPTS_SPECKIT) {
        unionData.push({
          name: builtIn.name,
          description: builtIn.description,
          type: UnionType.Prompt,
          meta: {
            description: builtIn.description,
            name: builtIn.name,
            prompt: builtIn.prompt,
            _id: `/${builtIn.name}`,
            type: PromptCategoryType._CodeMaker,
          },
        });
      }
    }

    for (const builtIn of BUILT_IN_PROMPTS) {
      if (chatType !== 'codebase' && builtIn.name === RULES_PROMPT['name']) {
        continue;
      }
      if (!['openspec-setup', 'speckit-setup'].includes(builtIn.name)) {
        unionData.push({
          name: builtIn.name,
          description: builtIn.description,
          type: UnionType.Prompt,
          meta: {
            description: builtIn.description,
            name: builtIn.name,
            prompt: builtIn.prompt,
            _id: `/${builtIn.name}`,
            type: PromptCategoryType._CodeMaker,
          },
        });
      }
    }

    for (const prompt of prompts) {
      const rowData: UnionData = {
        name: prompt.name,
        description: prompt.description,
        type: UnionType.Prompt,
        meta: prompt,
      };
      unionData.push(rowData);
    }
    for (const server of MCPServers || []) {
      const serverName = server?.name || '';
      const sPrompts: McpPrompt[] = server.prompts || [];
      for (const sp of sPrompts) {
        const fullName = `mcp.${serverName}.${sp?.name || ''}`;
        unionData.push({
          name: fullName,
          description: sp?.description,
          type: UnionType.Prompt,
          meta: {
            name: fullName,
            prompt: `/${fullName}`,
            _id: fullName,
            type: PromptCategoryType.MCP,
          },
        });
      }
    }
    // 在流式过程中禁用Clean选项
    if (!disabled) {
      // Skill Init 和 Skill Creator 目前只支持 VS Code
      unionData.push({
        name: 'Skill Init',
        description: '创建 Skill 模板文件',
        type: UnionType.Prompt,
        meta: {
          name: 'Skill Init',
          prompt: '创建 Skill 模板并在编辑器中打开',
          _id: '/skill-init',
          type: PromptCategoryType.Skill,
        },
      });
      // 如果用户已安装 skill-creator，则不显示内置命令
      const hasSkillCreator = skills.some((s) => s.name === 'skill-creator');
      if (!hasSkillCreator) {
        unionData.push({
          name: 'Skill Creator',
          description: '使用 AI 帮你创建专属 Skill',
          type: UnionType.Prompt,
          meta: {
            name: 'Skill Creator',
            prompt: '使用 AI 帮你创建专属 Skill',
            _id: '/skill-creator',
            type: PromptCategoryType.Skill,
          },
        });
      }
      unionData.push({
        name: 'New',
        description: '新建会话',
        type: UnionType.Prompt,
        meta: {
          name: 'New',
          prompt: '新建会话',
          _id: '/new',
          type: PromptCategoryType._CodeMaker,
        },
      });
      unionData.push({
        name: 'Clean',
        description: '清空当前会话',
        type: UnionType.Prompt,
        meta: {
          name: 'Clean',
          prompt: '清空当前会话',
          _id: '/clean',
          type: PromptCategoryType._CodeMaker,
        },
      });
      unionData.push({
        name: 'set-openspec',
        description: '将当前会话模式设置为 openspec',
        type: UnionType.Prompt,
        meta: {
          name: 'set-openspec',
          prompt: '会话切换到 openspec',
          _id: '/set-openspec',
          type: PromptCategoryType._CodeMaker,
        },
      });
      unionData.push({
        name: 'set-speckit',
        description: '将当前会话模式设置为 speckit',
        type: UnionType.Prompt,
        meta: {
          name: 'set-speckit',
          prompt: '会话切换到 speckit',
          _id: '/set-speckit',
          type: PromptCategoryType._CodeMaker,
        },
      });
      if (chatType === 'codebase' && !chatModels[chatConfig.model]?.isPrivate)
        unionData.push({
          name: 'Compress',
          description: '触发上下文压缩',
          type: UnionType.Prompt,
          meta: {
            name: 'Compress',
            prompt: '触发上下文压缩',
            _id: '/compress',
            type: PromptCategoryType._CodeMaker,
          },
        });
    }

    const subscribeApps = userConfig?.subscribe_app_tools;
    for (const plugin of pluginApps || []) {
      if (!subscribeApps?.includes(plugin._id)) {
        continue;
      }
      for (const shortcut of plugin.app_shortcuts) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { app_shortcuts, ...extra } = plugin;
        unionData.push({
          name: shortcut.name,
          description: shortcut.description,
          type: UnionType.Plugin,
          meta: { ...extra, app_shortcut: shortcut },
        });
      }
    }

    //如果当前处于codebase模式，加上codebase的prompt
    // if (chatType === 'codebase') {
    //   const reversedArray = Array.from(CODEBASE_EXAMPLE).reverse();
    //   {
    //     reversedArray.map((example) => {
    //       unionData.unshift({
    //         name: example.title,
    //         description: example.description,
    //         type: UnionType.Prompt,
    //         meta: {
    //           name: example.title,
    //           prompt: example.prompt,
    //           _id: example.title,
    //           type: PromptCategoryType._CodeMaker,
    //         },
    //       });
    //     });
    //   }
    // }
    if (mentionKeyword.trim()) {
      return unionData.filter((item) =>
        item.name.toLowerCase().includes(mentionKeyword.toLowerCase()),
      );
    } else {
      if (!promptType) {
        return unionData;
      }
      switch (promptType) {
        case PromptCategoryType.Project:
        case PromptCategoryType._CodeMaker: {
          return unionData.filter(
            (item) =>
              item.type === UnionType.Prompt && item.meta.type === promptType,
          );
        }
        case PromptCategoryType.User: {
          return unionData.filter(
            (item) =>
              item.type === UnionType.Prompt &&
              item.meta.type === PromptCategoryType.User,
          );
        }
        case PromptCategoryType.MCP: {
          return unionData.filter(
            (item) =>
              item.type === UnionType.Prompt &&
              item.meta.type === PromptCategoryType.MCP,
          );
        }
        case PromptCategoryType.Plugin: {
          return unionData.filter((item) => item.type === UnionType.Plugin);
        }
        case PromptCategoryType.Skill: {
          return unionData.filter(
            (item) =>
              item.type === UnionType.Prompt &&
              item.meta.type === PromptCategoryType.Skill,
          );
        }
        default:
          return [];
      }
    }
  }, [
    chatModels,
    chatType,
    disabled,
    userConfig?.subscribe_app_tools,
    mentionKeyword,
    prompts,
    MCPServers,
    chatConfig.model,
    pluginApps,
    promptType,
    skills,
    codebaseChatMode,
    installedOpenSpecVersion,
  ]);

  const currentIndex = getListIndex(renderPrompts, focusIndex);

  // 移除指令信息
  const removeMentionKeyword = React.useCallback(() => {
    if (userInputRef.current) {
      const { selectionStart = 0, value = '' } = userInputRef.current;
      // 找指令
      const includedMentionText = value.slice(0, selectionStart);
      let mentionCursor = -1;
      for (let i = 0; i < includedMentionText.length; i++) {
        if (
          [TypeAheadModePrefix.Prompt].includes(
            includedMentionText[i] as TypeAheadModePrefix,
          )
        ) {
          mentionCursor = i;
        }
      }
      if (mentionCursor >= 0) {
        const newValue =
          value.slice(0, mentionCursor) +
          value.slice(selectionStart, value.length);
        userInputRef.current.value = newValue;
      }
      userInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      userInputRef.current?.setSelectionRange?.(mentionCursor, mentionCursor);
      userInputRef.current.focus();
    }
  }, [userInputRef]);

  const handleSubmitPrompt = React.useCallback(
    async (prompt: UnionData) => {
      // 根据 Plugin 和 Prompt 进行对应的逻辑处理
      // 1. Plugin App 进行挂载
      // 2. Prompt 直接提交
      switch (prompt.type) {
        case UnionType.Prompt: {
          if (prompt.name.startsWith(MERMAID_SIGN)) {
            const cloneData = { ...prompt };
            // cloneData.meta.prompt = `/${cloneData.name.replace(/\([^)]*\)|（[^）]*）/g, '')}`;
            cloneData.meta.prompt = `/${cloneData.name}`;
            updatePromptAppRunner(cloneData);
          } else if (prompt.name === 'Skill Init') {
            const templateContent = `---\nname: template-skill\ndescription: Replace with description of the skill and when Codemaker should use it.\n---\n\n# Insert instructions below\n`;
            window.parent.postMessage({
              type: BroadcastActions.CREATE_SKILL_TEMPLATE,
              panelId: currentPanelId,
              data: { templateContent },
            }, '*');
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
          } else if (prompt.name === 'Skill Creator') {
            setSkillLoading(true);
            window.parent.postMessage({
              type: BroadcastActions.INSTALL_BUILTIN_SKILL,
              panelId: currentPanelId,
              data: {
                skillName: 'skill-creator',
                downloadUrl: `${SKILLS_HUB_API_URL}/api/skills/@skill-creator/download`,
              },
            }, '*');
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
          } else if (prompt.name === 'openspec-update') {
            setOpenspecUpdateModalVisible(true);
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
          } else if (
            [
              // 支持 OpenSpec 0.23 和 1.x 的所有命令
              ...BUILT_IN_PROMPTS_OPENSPEC_V023.map(openspecPrompt => openspecPrompt.name),
              ...BUILT_IN_PROMPTS_OPENSPEC_V1.map(openspecPrompt => openspecPrompt.name),
              ...BUILT_IN_PROMPTS_SPECKIT.map(speckitPrompt => speckitPrompt.name)
            ].includes(prompt.name)
          ) {
            updatePromptAppRunner(prompt);
          } else if (prompt.name === 'New') {
            // 新建会话 - 复用 ChatHeaderToolbar 的逻辑
            setTimeout(() => {
              if (userInputRef.current) {
                userInputRef.current.value = '';
              }
            }, 100);
            await handleNewSessionCommand();
          } else if (prompt.name === 'Clean') {
            setTimeout(() => {
              if (userInputRef.current) {
                userInputRef.current.value = '';
              }
            }, 1000);
            clearSession();
          } else if (prompt.name === 'set-openspec') {
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
            setCodebaseChatMode('openspec');
          } else if (prompt.name === 'set-speckit') {
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
            setCodebaseChatMode('speckit');
          } else if (prompt.name === 'Compress') {
            const currentSessionId = useChatStore.getState().currentSessionId;
            if (currentSessionId) {
              useChatStore.getState().triggerCompression(currentSessionId);
            }
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
          } else {
            if (prompt.meta.type === PromptCategoryType.MCP) {
              const fullName = prompt.meta.name || '';
              const parts = fullName.split('.');
              if (parts.length >= 3) {
                const serverName = parts.slice(1, parts.length - 1).join('.');
                const promptName = parts[parts.length - 1];
                const server = (MCPServers || []).find(
                  (s) => s.name === serverName,
                );
                const sPrompts: McpPrompt[] = server?.prompts || [];
                const matched = (sPrompts.find((p) => p?.name === promptName) ||
                  {}) as McpPrompt;
                const args: {
                  name: string;
                  description?: string;
                  required?: boolean;
                }[] = matched?.arguments || [];
                setPendingRunner({
                  serverName,
                  promptName,
                  title: `/${fullName}`,
                  arguments: args,
                });
              }
            } else if (prompt.meta.type === PromptCategoryType.Skill) {
              const skillName = prompt.meta.name || '';
              setSkillLoading(true);
              postMessage({
                type: BroadcastActions.TOOL_CALL,
                data: {
                  tool_name: 'use_skill',
                  tool_params: { skill_name: skillName },
                  tool_id: createSkillToolId(),
                },
              });
              if (userInputRef.current) {
                userInputRef.current.value = '';
              }
            } else if (prompt.meta.type === PromptCategoryType.CodeWiki) {
              updatePromptAppRunner(prompt);
            } else {
              props.onSubmit(prompt.meta);
            }
          }
          break;
        }
        case UnionType.Plugin: {
          if (attachs?.attachType === AttachType.NetworkModel) {
            updateAttachs(undefined);
          }
          updatePluginAppRunner(prompt.meta);
          // 如果是自动触发的插件指令，那么直接提交，并且 prompt 是空
          if (
            !prompt.meta.app_shortcut?.params?.length &&
            prompt.meta.app_shortcut?.auto_trigger
          ) {
            props.onSubmit({
              ...prompt.meta,
              name: prompt.meta.app_shortcut.name,
              prompt: ' ',
              type: PromptCategoryType.Plugin,
            });
          }
          if (userInputRef.current) {
            userInputRef.current.value = '';
          }
          break;
        }
      }
      removeMentionKeyword();
      props.updateOpenState(false);
    },
    [
      removeMentionKeyword,
      props,
      updatePromptAppRunner,
      attachs?.attachType,
      updatePluginAppRunner,
      userInputRef,
      updateAttachs,
      MCPServers,
      setPendingRunner,
      clearSession,
      postMessage,
      setSkillLoading,
      setCodebaseChatMode,
      handleNewSessionCommand,
      setOpenspecUpdateModalVisible,
      currentPanelId
    ],
  );

  React.useEffect(() => {
    const element = userInputRef?.current;
    function addEnterEventLinstener(event: KeyboardEvent) {
      if (checkValueOfPressedKeyboard(event, ['Enter'])) {
        const prompt = renderPrompts[currentIndex];
        if (prompt) {
          handleSubmitPrompt(prompt);
          event.preventDefault();
          event.stopPropagation();
        }
      } else if (checkValueOfPressedKeyboard(event, ['Tab'])) {
        // Tab 直接应用某个 prompt template 到输入框中
        const prompt = renderPrompts[currentIndex];
        if (userInputRef.current && prompt) {
          if (prompt.type === UnionType.Plugin) {
            updatePluginAppRunner(prompt.meta);
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
          } else if (prompt.meta.prompt.startsWith('/mcp.')) {
            // MCP Prompt: 打开参数表单
            const parts = prompt.meta.prompt.slice(5).split('.');
            if (parts.length >= 2) {
              const serverName = parts[0];
              const promptName = parts.slice(1).join('.');
              const mcpServer = MCPServers.find((s) => s.name === serverName);
              const sPrompts: McpPrompt[] = mcpServer?.prompts || [];
              const mcpPrompt = sPrompts.find(
                (p: McpPrompt) => p.name === promptName,
              );
              if (mcpPrompt) {
                setPendingRunner({
                  serverName,
                  promptName,
                  title: prompt.meta.name,
                  arguments: mcpPrompt.arguments || [],
                });
              }
            }
            if (userInputRef.current) {
              userInputRef.current.value = '';
            }
          } else {
            userInputRef.current.value = prompt.meta.prompt;
          }
        }
        updateOpenState(false);
        event.preventDefault();
        event.stopPropagation();
      }
    }

    element?.addEventListener('keydown', addEnterEventLinstener);
    return () => {
      element?.removeEventListener('keydown', addEnterEventLinstener);
    };
  }, [
    currentIndex,
    handleSubmitPrompt,
    isDuringKeywordSearch,
    props,
    renderPrompts,
    updateOpenState,
    updatePluginAppRunner,
    userInputRef,
    MCPServers,
    setPendingRunner,
  ]);

  React.useEffect(() => {
    if (message?.type !== SubscribeActions.CREATE_SKILL_TEMPLATE_RESULT) {
      return;
    }
    
    // 如果消息指定了 targetPanelId，只有匹配的面板处理
    const targetPanelId = message?.targetPanelId;
    if (targetPanelId && targetPanelId !== currentPanelId) {
      return;
    }
    
    const result = (message.data || {}) as {
      success?: boolean;
      message?: string;
      path?: string;
    };
    if (result.success) {
      toast({
        title: 'Skill 模板已创建',
        status: 'success',
        position: 'top',
        duration: 2000,
        isClosable: true,
      });
      if (result.path) {
        postMessage({
          type: 'OPEN_FILE',
          data: { filePath: result.path },
        });
      }
    } else {
      toast({
        title: 'Skill 模板创建失败',
        description: result.message || '请检查工作区权限或路径',
        status: 'error',
        position: 'top',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [message, toast, postMessage, currentPanelId]);


  const handleEditPrompt = (prompt: Prompt) => {
    (window as any).__openEditPromptModal?.(prompt);
  };

  const handleRemovePrompt = (prompt: Prompt) => {
    (window as any).__openRemovePromptModal?.(prompt);
  };

  const handleChangePromptType = (type: PromptCategoryType) => {
    setPromptType(type);
  };

  const triggerCustomPromptSample = React.useCallback(
    (formValue: PromptSampleFormValue) => {
      setIsOpenNewPromptModel(true);
      setTimeout(() => {
        if (newPromptModelRef.current) {
          newPromptModelRef.current.setFormValue({
            ...formValue,
          });
        }
      });
    },
    [],
  );

  React.useEffect(() => {
    setCustomPromptSampleCallback(triggerCustomPromptSample);
  }, [triggerCustomPromptSample, setCustomPromptSampleCallback]);

  return (
    <>
      <Flex
        flexDirection="column"
        justifyContent="space-between"
        p={2}
        gap={2}
        // backgroundColor="blackAlpha.300"
        backgroundColor="themeBgColor"
        display={isDuringKeywordSearch ? 'none' : 'flex'}
      >
        <Flex flexDirection="column" gap={2}>
          <Tooltip label="系统" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="codemaker"
              colorScheme={
                promptType === PromptCategoryType._CodeMaker
                  ? 'blue'
                  : undefined
              }
              bg={
                promptType === PromptCategoryType._CodeMaker
                  ? 'blue.300'
                  : 'buttonBgColor'
              }
              border="1px solid"
              borderColor="customBorder"
              color={
                promptType === PromptCategoryType._CodeMaker
                  ? 'white'
                  : 'text.primary'
              }
              icon={<Icon as={LuAirplay} size="md" />}
              onClick={() =>
                handleChangePromptType(PromptCategoryType._CodeMaker)
              }
            />
          </Tooltip>
          <Tooltip label="项目" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="project"
              colorScheme={
                promptType === PromptCategoryType.Project ? 'blue' : undefined
              }
              color={
                promptType === PromptCategoryType.Project
                  ? 'white'
                  : 'text.primary'
              }
              bg={
                promptType === PromptCategoryType.Project
                  ? 'blue.300'
                  : 'buttonBgColor'
              }
              border="1px solid"
              borderColor="customBorder"
              icon={<Icon as={LuBox} size="md" />}
              onClick={() => handleChangePromptType(PromptCategoryType.Project)}
            />
          </Tooltip>
          <Tooltip label="我的自定义指令" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="user"
              colorScheme={
                promptType === PromptCategoryType.User ? 'blue' : undefined
              }
              color={
                promptType === PromptCategoryType.User
                  ? 'white'
                  : 'text.primary'
              }
              bg={
                promptType === PromptCategoryType.User
                  ? 'blue.300'
                  : 'buttonBgColor'
              }
              border="1px solid"
              borderColor="customBorder"
              icon={<Icon as={LuUser} size="md" />}
              onClick={() => handleChangePromptType(PromptCategoryType.User)}
            />
          </Tooltip>
          <Tooltip label="Skills" placement="right">
            <IconButton
              fontSize="xl"
              aria-label="skill"
              colorScheme={
                promptType === PromptCategoryType.Skill ? 'blue' : undefined
              }
              color={
                promptType === PromptCategoryType.Skill
                  ? 'white'
                  : 'text.primary'
              }
              bg={
                promptType === PromptCategoryType.Skill
                  ? 'blue.300'
                  : 'buttonBgColor'
              }
              border="1px solid"
              borderColor="customBorder"
              icon={<Icon as={TbWand} size="md" />}
              onClick={() => handleChangePromptType(PromptCategoryType.Skill)}
            />
          </Tooltip>
          {hasMcpPrompts && (
            <Tooltip label="MCP 指令" placement="right">
              <IconButton
                fontSize="xl"
                aria-label="mcp"
                colorScheme={
                  promptType === PromptCategoryType.MCP ? 'blue' : undefined
                }
                color={
                  promptType === PromptCategoryType.MCP
                    ? 'white'
                    : 'text.primary'
                }
                bg={
                  promptType === PromptCategoryType.MCP
                    ? 'blue.300'
                    : 'buttonBgColor'
                }
                border="1px solid"
                borderColor="customBorder"
                icon={<Icon as={TbCube} size="md" />}
                onClick={() => handleChangePromptType(PromptCategoryType.MCP)}
              />
            </Tooltip>
          )}
          {isVscode && (
            <Tooltip label="我订阅的插件指令" placement="right">
              <IconButton
                fontSize="xl"
                aria-label="plugin"
                colorScheme={
                  promptType === PromptCategoryType.Plugin ? 'blue' : undefined
                }
                color={
                  promptType === PromptCategoryType.Plugin
                    ? 'white'
                    : 'text.primary'
                }
                bg={
                  promptType === PromptCategoryType.Plugin
                    ? 'blue.300'
                    : 'buttonBgColor'
                }
                border="1px solid"
                borderColor="customBorder"
                icon={<Icon as={RiStoreFill} size="md" />}
                onClick={() =>
                  handleChangePromptType(PromptCategoryType.Plugin)
                }
              />
            </Tooltip>
          )}
        </Flex>
      </Flex>
      <Grid
        w="full"
        p={2}
        gridTemplateRows={isDuringKeywordSearch ? '1fr auto' : 'auto 1fr auto'}
        h="256px"
        bg="themeBgColor"
        color="text.primary"
      >
        {!isDuringKeywordSearch && promptType && (
          <Flex mb={2} placeContent="space-between">
            <Text p={1} pb={2} fontSize="sm" color="text.primary">
              {promptCategoryNameMap[promptType]}
            </Text>
            {promptType === PromptCategoryType.Project && (
              <Button size="sm" onClick={handleOpenProjectPromptManageWebsite}>
                管理
              </Button>
            )}
            {promptType === PromptCategoryType.User && (
              <Tooltip label="自定义我的快捷指令" placement="right">
                <IconButton
                  fontSize="small"
                  size="sm"
                  aria-label="add"
                  icon={<Icon as={TbPlus} size="sm" />}
                  onClick={() => {
                    setIsOpenNewPromptModel(true);
                  }}
                />
              </Tooltip>
            )}
            {promptType === PromptCategoryType.Plugin && (
              <Tooltip label="前往插件市场订阅" placement="right">
                <Button
                  size="sm"
                  onClick={() => onTypeAheadModeChange(TypeAheadMode.Plugin)}
                >
                  订阅更多
                </Button>
              </Tooltip>
            )}
          </Flex>
        )}
        <PromptList
          loading={loading}
          prompts={renderPrompts}
          currentIndex={currentIndex}
          onSubmit={handleSubmitPrompt}
          onEdit={handleEditPrompt}
          onRemove={handleRemovePrompt}
        />
      </Grid>
      <ChatNewPromptModel
        isOpen={isOpenNewPromptModel}
        onClose={() => setIsOpenNewPromptModel(false)}
        ref={newPromptModelRef}
      />
    </>
  );
};

// 将编辑和删除 Modal 移到组件外部，作为独立的组件导出
export function PromptModals() {
  const [currentHandlePrompt, setCurrentHandlePrompt] = React.useState<Prompt>();
  const [isOpenEditPromptModel, setIsOpenEditPromptModel] = React.useState(false);
  const [isOpenRemovePromptModel, setIsOpenRemovePromptModel] = React.useState(false);

  // 暴露方法给外部调用
  React.useEffect(() => {
    (window as any).__openEditPromptModal = (prompt: Prompt) => {
      setCurrentHandlePrompt(prompt);
      setIsOpenEditPromptModel(true);
    };
    (window as any).__openRemovePromptModal = (prompt: Prompt) => {
      setCurrentHandlePrompt(prompt);
      setIsOpenRemovePromptModel(true);
    };
  }, []);

  return (
    <>
      {currentHandlePrompt && (
        <>
          <ChatEditPromptModel
            isOpen={isOpenEditPromptModel}
            prompt={currentHandlePrompt}
            onClose={() => setIsOpenEditPromptModel(false)}
          />
          <ChatRemovePromptModel
            isOpen={isOpenRemovePromptModel}
            prompt={currentHandlePrompt}
            onClose={() => setIsOpenRemovePromptModel(false)}
          />
        </>
      )}
    </>
  );
}

export default PromptsPanel;