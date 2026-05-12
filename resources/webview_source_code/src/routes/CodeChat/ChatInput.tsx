import React, { useMemo } from 'react';
import ChatTypeAhead from './ChatTypeAhead';
import { ChatTypeAheadHandle } from './ChatTypeAhead/ChatTypeAhead';
import {
  allowedTypes,
  HandleImageUpload,
} from '../../components/ImageUpload/ImageUpload';
import { Prompt } from '../../services/prompt';
import {
  useChatAttach,
  useChatPromptStore,
  useChatStore,
  useChatStreamStore,
} from '../../store/chat';
import { usePluginApp } from '../../store/plugin-app';
import { Box } from '@chakra-ui/react';
import ChatPluginAppRunner from './ChatPluginAppRunner';
import ChatMcpPromptRunner from './ChatMcpPromptRunner';
import ChatSkillPromptRunner from './ChatSkillPromptRunner';
import ChatAgentPromptRunner from './ChatAgentPromptRunner';
import ChatPromptAppRunner from './ChatPromptAppRunner';
import ChatAttachs from './ChatAttachs';
import CodeChatInputActionBar from './CodeChatInputActionBar';
import { useEventContext } from '../eventProviderContext';
import { useChatConfig } from '../../store/chat-config';
import useCustomToast from '../../hooks/useCustomToast';
import { uploadImg } from '../../services/chat';
import { AttachType } from '../../store/attaches';
import { DebouncedFunc } from 'lodash';
// import { TypeAheadMode } from './ChatTypeAhead/const';
import useSubmitHandler from '../../hooks/useSubmitHandler';
import { useConfigStore } from '../../store/config';
// import { useExtensionStore } from '../../store/extension';
import { useMaskStore } from '../../store/mask';
import { useWorkspaceStore, SpecFramework } from '../../store/workspace';
import { ChatMessageContent, ChatMessageContentUnion } from '../../services';
import { checkValueOfPressedKeyboard, isMacOS } from '../../utils';
import { validateBeforeChat } from '../../utils/validateBeforeChat';
import { useAuthStore } from '../../store/auth';
// import { useUserConfig } from '../../store/user-config';
import ChatMentionAreatext from './ChatMentionAreatext';
import { ChatRole } from '../../types/chat';
import { useSelectImageAttach } from './ChatTypeAhead/Attach/Hooks/useSelectImageAttach';
import { ParseImgType } from '../../services/chatModel';
import { useTerminalMessage } from './ChatMessagesList/TermialPanel';
import { useAgentPromptStore } from '../../store/agent-prompt';
import {
  AgentTaskDirective,
  buildAgentTaskDirective,
} from '../../modules/subagent/utils/messages';
import { compressImage } from '../../components/ImageUpload/ImageResize';
// import EventBus, { EBusEvent } from '../../utils/eventbus';

interface ChatInputProp {
  handleSubmit: (
    prompt: string,
    options?: { agentTaskDirective?: AgentTaskDirective },
  ) => Promise<void>;
  handleInputChange: DebouncedFunc<() => Promise<void>>;
  tokenNumber: number;
  isFocused: boolean;
  setFocused: (focused: boolean) => void;
  scrollToBottom: () => void;
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  promptProtalRef: React.MutableRefObject<ChatTypeAheadHandle | null>;
  uploadImgRef: React.MutableRefObject<HandleImageUpload | null>;
  promptRef: React.MutableRefObject<Prompt | null>;
  fillInputRef?: React.MutableRefObject<((text: string) => void) | null>;
}

function ChatInput(props: ChatInputProp) {
  const {
    handleSubmit,
    tokenNumber,
    handleInputChange,
    isFocused,
    setFocused,
    inputRef,
    promptProtalRef,
    uploadImgRef,
    promptRef,
    fillInputRef,
  } = props;
  const isMac = isMacOS();

  const triggerPromptProtalRef = React.useRef<HTMLDivElement>(null);
  const triggerMaskProtalRef = React.useRef<HTMLDivElement>(null);
  const triggerPluginProtalRef = React.useRef<HTMLDivElement>(null);

  const { toast } = useCustomToast();
  const attachs = useChatAttach((state) => state.attachs);
  const chatModels = useChatConfig((state) => state.chatModels);
  const { shouldSubmit } = useSubmitHandler();
  const selectImageHook = useSelectImageAttach();

  const updateChatPrompt = useChatPromptStore((state) => state.update);
  // const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const onStreamStop = useChatStreamStore((state) => state.onStop);
  const pluginApp = usePluginApp((state) => state.runner);
  const config = useConfigStore((state) => state.config);
  const chatType = useChatStore((state) => state.chatType);
  const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);
  const isDisabledAttachs = useMaskStore((state) => state.isDisabledAttachs());
  const currentSession = useChatStore((state) => state.currentSession());
  const messagePool = useMemo(() => {
    return currentSession?.data?.messages || [];
  }, [currentSession?.data?.messages]);
  const [currentSendMessageIndex, setCurrentSendMessageIndex] = React.useState<
    number | null
  >(null);
  const inputDraftRef = React.useRef<string>('');
  // const ide = useExtensionStore((state) => state.IDE);
  const [workspaceInfo, isSpecFrameworkInitialized] = useWorkspaceStore(
    (state) => [state.workspaceInfo, state.isSpecFrameworkInitialized],
  );
  // const clickInstruction = useUserConfig((state) => state.clickInstruction);
  // const setClickInstruction = useUserConfig((state) => state.setClickInstruction);
  const onUpdatePrePromptCodeBlock = useChatStreamStore(
    (state) => state.onUpdatePrePromptCodeBlock,
  );

  const model = useChatConfig((state) => state.config.model);
  const cUnrestrict = useAuthStore((state) => state.authExtends.c_unrestrict);

  const { updateHistory } = useEventContext();
  const { stopRunningTerminal } = useTerminalMessage();

  const agentRunner = useAgentPromptStore((state) => state.runner);
  const clearAgentRunner = useAgentPromptStore((state) => state.clear);

  const submitChatInput = React.useCallback(async () => {
    const userInput = inputRef.current?.value.trim() || '';
    // 当用户选择了 Agent Runner 时，构建约束指令注入到消息中，
    // 强制主模型调用 task 工具并携带对应的 subagent_type
    const agentTaskDirective = buildAgentTaskDirective({
      chatType,
      agentName: agentRunner?.name,
    });

    await handleSubmit(userInput, { agentTaskDirective });

    if (agentTaskDirective) {
      clearAgentRunner();
    }

    // 重置往上查找的历史会话和草稿
    setCurrentSendMessageIndex(null);
    inputDraftRef.current = '';
  }, [agentRunner?.name, chatType, clearAgentRunner, handleSubmit, inputRef]);

  React.useEffect(() => {
    if (chatType !== 'codebase' && agentRunner) {
      clearAgentRunner();
    }
  }, [agentRunner, chatType, clearAgentRunner]);

  const handleSubmitWithTemplate = async (prompt: Prompt) => {
    promptRef.current = prompt;
    updateChatPrompt(prompt);
    // 兼容 Prompt.extra_parameters 中携带的约束指令（如特殊内置模板）
    const extraParams = prompt.extra_parameters as
      | { agentTaskDirective?: AgentTaskDirective }
      | undefined;
    handleSubmit(prompt.prompt, {
      agentTaskDirective: extraParams?.agentTaskDirective,
    });
    // 重置往上查找的历史会话
    setCurrentSendMessageIndex(null);
  };

  // 使用原生插入文本方法，保持浏览器原生的 undo/redo 功能
  const insertTextNatively = React.useCallback(
    (text: string) => {
      if (inputRef.current) {
        inputRef.current.focus();

        // 使用 execCommand 插入文本，这样会保持原生的 undo 历史
        // 不再选中所有文本，直接在光标位置插入
        if (document.execCommand) {
          document.execCommand('insertText', false, text);
        } else {
          // 备用方案（对于不支持 execCommand 的浏览器）
          const start = inputRef.current.selectionStart || 0;
          const end = inputRef.current.selectionEnd || 0;
          const value = inputRef.current.value;
          const newValue =
            value.substring(0, start) + text + value.substring(end);
          inputRef.current.value = newValue;
          // 将光标移动到插入文本后
          inputRef.current.selectionStart = inputRef.current.selectionEnd =
            start + text.length;
        }

        setFocused(true);
        handleInputChange();
      }
    },
    [inputRef, setFocused, handleInputChange],
  );

  const fillInput = React.useCallback(
    (text: string) => {
      insertTextNatively(text);
    },
    [insertTextNatively],
  );

  const uploadImgByBase64 = React.useCallback(
    async (imageData: string) => {
      try {
        if (imageData.length > 10 * 1024 * 1024) {
          toast({
            title: '上传失败',
            description: '图片大小超过10M限制',
            position: 'top',
            status: 'error',
            isClosable: true,
            duration: 2000,
          });
          return;
        }

        const [header, data] = imageData.split(',');
        if (!header || !data) {
          toast({
            title: '上传失败',
            description: '图片格式错误',
            position: 'top',
            status: 'error',
            isClosable: true,
            duration: 2000,
          });
          return;
        }

        const mimeType = header.split(':')[1].split(';')[0];
        if (!allowedTypes.includes(mimeType)) {
          toast({
            title: '上传失败',
            description: '只允许上传：.jpeg、.png、.webp、.gif 格式的图片',
            position: 'top',
            status: 'error',
            isClosable: true,
            duration: 2000,
          });
          return;
        }

        // 根据 MIME 类型确定文件扩展名
        const getExtension = (mime: string) => {
          const extensions = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
          };
          return extensions[mime as keyof typeof extensions] || 'png';
        };

        const extension = getExtension(mimeType);
        const fileName = `image_${Date.now()}.${extension}`;

        const formData = new FormData();
        const blob = await fetch(imageData).then((res) => res.blob());
        const file = new File([blob], fileName, { type: mimeType });
        const smallFile = await compressImage(file);
        formData.append('file', smallFile);

        const imgUrl = await uploadImg(formData);
        selectImageHook.selectImageAttach([imgUrl.url]);
      } catch (error) {
        console.error(error);
        toast({
          title: '上传失败',
          description: '发生未知错误',
          position: 'top',
          status: 'error',
          isClosable: true,
          duration: 2000,
        });
      }
    },
    [selectImageHook, toast],
  );

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const { clipboardData } = e;
      const { items, files, types } = clipboardData;

      const insertTextAndUpdate = (text: string) => {
        const input = e.target as HTMLTextAreaElement;
        const start = input.selectionStart;
        const end = input.selectionEnd;

        // 确保 textarea 有焦点且 selection 正确
        input.focus();
        input.setSelectionRange(start, end);

        // 记录执行前的值，用于判断 execCommand 是否实际生效
        const valueBefore = input.value;

        // 使用 execCommand('insertText') 插入文本，保持浏览器原生 undo 栈完整
        // 这样在 PyCharm JCEF 等环境中 Ctrl+Z 可以正常撤销粘贴内容
        // 注意：execCommand 返回值在现代浏览器中不可靠，需要通过值变化来判断是否生效
        document.execCommand('insertText', false, text);

        if (input.value === valueBefore && text.length > 0) {
          // execCommand 未生效，降级方案：直接设置 value（会破坏原生 undo 栈）
          const beforeText = input.value.substring(0, start);
          const afterText = input.value.substring(end);
          const newValue = beforeText + text + afterText;
          input.value = newValue;
          input.setSelectionRange(start + text.length, start + text.length);
        }

        updateHistory(input, input.value);

        // 滚动到光标位置,确保粘贴后光标可见
        requestAnimationFrame(() => {
          if (input) {
            const newCursorPosition = input.selectionStart || 0;
            // 创建一个临时的测量元素来计算光标位置
            const temp = document.createElement('div');
            const style = window.getComputedStyle(input);

            // 复制textarea的样式到临时元素
            temp.style.cssText = `
              position: absolute;
              visibility: hidden;
              white-space: pre-wrap;
              word-wrap: break-word;
              font: ${style.font};
              padding: ${style.padding};
              border: ${style.border};
              width: ${input.clientWidth}px;
              line-height: ${style.lineHeight};
            `;

            // 只包含光标之前的文本
            temp.textContent = input.value.substring(0, newCursorPosition);
            document.body.appendChild(temp);

            // 计算光标的高度位置
            const cursorHeight = temp.scrollHeight;
            document.body.removeChild(temp);

            // 计算理想的滚动位置,让光标位于可视区域中间
            const textareaHeight = input.clientHeight;
            const idealScrollTop = cursorHeight - textareaHeight / 2;

            // 确保滚动位置不会超出范围
            input.scrollTop = Math.max(
              0,
              Math.min(idealScrollTop, input.scrollHeight - textareaHeight),
            );
          }
        });
      };

      if (items) {
        if (files && files[0]?.type.startsWith('image')) {
          if ([ParseImgType.BASE64].includes(chatModels[model]?.parseImgType)) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64Image = event.target?.result as string;
              if (inputRef.current) {
                uploadImgByBase64(base64Image);
              }
            };
            reader.readAsDataURL(files[0]);
          } else {
            toast({
              title: '该模型不支持选择图片',
              position: 'top',
              status: 'warning',
              isClosable: true,
              duration: 2000,
            });
          }
        } else if (types.includes('vscode-editor-data')) {
          const codeData = clipboardData.getData('vscode-editor-data');
          const textData = clipboardData.getData('text/plain') || '';
          if (codeData && textData.includes('\n')) {
            const { mode } = JSON.parse(codeData);
            if (!validateBeforeChat(mode, model, cUnrestrict)) return;
            onUpdatePrePromptCodeBlock({
              language: mode,
              content: textData,
              path: '',
            });
          } else {
            insertTextAndUpdate(textData);
          }
        } else {
          handleInputChange();
          insertTextAndUpdate(clipboardData.getData('text/plain'));
        }
      }
    },
    [
      chatModels,
      updateHistory,
      model,
      inputRef,
      uploadImgByBase64,
      toast,
      onUpdatePrePromptCodeBlock,
      handleInputChange,
      cUnrestrict,
    ],
  );

  // 会话改变的时候重置发送消息索引和草稿
  React.useEffect(() => {
    setCurrentSendMessageIndex(null);
    inputDraftRef.current = '';
  }, [currentSession]);

  // 监听初始化 prompt 事件（从 ChatMentionAreatext 组件发出）
  // React.useEffect(() => {
  //   const handleInitPrompt = (prompt: string) => {
  //     handleSubmit(prompt);
  //   };
  //   EventBus.instance.on(EBusEvent.Submit_Init_Prompt, handleInitPrompt);
  //   return () => {
  //     EventBus.instance.off(EBusEvent.Submit_Init_Prompt, handleInitPrompt);
  //   };
  // }, [handleSubmit]);

  const focusInput = React.useCallback(
    (contentLength: number) => {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(contentLength, contentLength);
          inputRef.current.focus();
        }
      });
    },
    [inputRef],
  );

  /** 从历史消息中提取纯文本内容 */
  const getHistoryContent = React.useCallback(
    (msg: (typeof messagePool)[number]): string => {
      if (msg.content instanceof Array) {
        return (
          (msg.content as ChatMessageContentUnion[]).find(
            (i) => i.type === ChatMessageContent.Text,
          )?.text || ''
        );
      }
      return (msg.content as string) || '';
    },
    [],
  );

  /** 切换到指定历史 index，并将对应内容填入输入框 */
  const switchToHistoryIndex = React.useCallback(
    (index: number, messages: typeof messagePool) => {
      setCurrentSendMessageIndex(index);
      if (inputRef.current) {
        const content = getHistoryContent(messages[index]);
        inputRef.current.value = content;
        focusInput(content.length);
      }
    },
    [inputRef, getHistoryContent, focusInput],
  );

  const handleInputKeyDown = React.useCallback(
    async (event: React.KeyboardEvent) => {
      // 按 ESC 退出输入框聚焦，让键盘事件能冒泡到 VSCode 层（如 cmd+p）
      if (event.key === 'Escape') {
        inputRef.current?.blur();
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        // Ctrl+Z/Cmd+Z 撤回功能由 EventProvider 全局处理（自定义 historyStack），
        // ChatInput 不需要额外处理，让事件正常冒泡即可

        if (checkValueOfPressedKeyboard(event, ['KeyA'], ['a', 'A'])) {
          // 模拟 command+A 选中全部
          if (inputRef.current) {
            if (inputRef.current === document.activeElement) {
              inputRef.current.select();
            }
          }
        }
        const filterSendMessage = messagePool.filter(
          (item) => item.role === ChatRole.User,
        );
        if (checkValueOfPressedKeyboard(event, ['ArrowUp'])) {
          if (filterSendMessage.length > 0) {
            const currentInput = inputRef.current?.value ?? '';

            if (currentSendMessageIndex === null) {
              // 尚未进入历史模式：保存当前草稿，进入历史模式从最新一条开始
              inputDraftRef.current = currentInput;
              switchToHistoryIndex(
                filterSendMessage.length - 1,
                filterSendMessage,
              );
            } else {
              // 已在历史模式中：检查当前输入是否与该 index 原始历史内容一致
              const originalContent = getHistoryContent(
                filterSendMessage[currentSendMessageIndex],
              );
              if (currentInput !== originalContent) {
                // 用户在历史基础上修改了内容 → 将修改内容存为新草稿，重置索引重新翻
                inputDraftRef.current = currentInput;
                switchToHistoryIndex(
                  filterSendMessage.length - 1,
                  filterSendMessage,
                );
              } else {
                // 未修改，正常向上翻
                switchToHistoryIndex(
                  Math.max(currentSendMessageIndex - 1, 0),
                  filterSendMessage,
                );
              }
            }
          }
        }

        if (checkValueOfPressedKeyboard(event, ['ArrowDown'])) {
          if (
            filterSendMessage.length > 0 &&
            currentSendMessageIndex !== null
          ) {
            const currentInput = inputRef.current?.value ?? '';
            const originalContent = getHistoryContent(
              filterSendMessage[currentSendMessageIndex],
            );

            if (currentInput !== originalContent) {
              // 用户在历史基础上修改了内容 → 将修改内容存为新草稿，退出历史模式
              inputDraftRef.current = currentInput;
              setCurrentSendMessageIndex(null);
              // 退出历史模式时，输入框保持当前内容（即修改后的内容），无需额外赋值
              focusInput(currentInput.length);
            } else {
              // 未修改，正常向下翻
              const newIndex = currentSendMessageIndex + 1;
              if (newIndex >= filterSendMessage.length) {
                // 已到达最新，恢复草稿内容
                setCurrentSendMessageIndex(null);
                if (inputRef.current) {
                  const draft = inputDraftRef.current;
                  inputRef.current.value = draft;
                  focusInput(draft.length);
                }
              } else {
                switchToHistoryIndex(newIndex, filterSendMessage);
              }
            }
          }
        }
      }

      // 当设置为 Enter 发送时，处理 Ctrl+Enter (Windows/Linux) 或 Cmd+Enter (Mac) 换行
      if (config.submitKey === 'Enter' && event.key === 'Enter') {
        const shouldHandleNewline = isMac
          ? event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
          : event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

        if (shouldHandleNewline) {
          if (inputRef.current) {
            const start = inputRef.current.selectionStart;
            const end = inputRef.current.selectionEnd;
            const value = inputRef.current.value;

            // 在光标位置插入换行符
            const newValue =
              value.substring(0, start) + '\n' + value.substring(end);
            inputRef.current.value = newValue;

            // 设置光标位置到换行符后
            const newCursorPosition = start + 1;
            inputRef.current.setSelectionRange(
              newCursorPosition,
              newCursorPosition,
            );

            // 触发输入变化事件
            handleInputChange();

            // 确保输入框滚动到合适位置，让用户能看到新输入的内容
            requestAnimationFrame(() => {
              if (inputRef.current) {
                // 滚动到底部，确保新行可见
                inputRef.current.scrollTop = inputRef.current.scrollHeight;

                // 重新聚焦输入框
                inputRef.current.focus();
              }
            });

            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
      }

      if (shouldSubmit(event)) {
        event.stopPropagation();
        event.preventDefault();
        await submitChatInput();
      }
    },
    [
      switchToHistoryIndex,
      currentSendMessageIndex,
      focusInput,
      getHistoryContent,
      messagePool,
      shouldSubmit,
      config.submitKey,
      handleInputChange,
      inputRef,
      isMac,
      submitChatInput,
    ],
  );

  const handleTriggerPromptTemplate = () => {
    if (inputRef.current) {
      const currentValue = inputRef.current.value;
      const cursorPosition = inputRef.current.selectionStart || 0;

      // 在光标位置插入 / 符号
      const beforeCursor = currentValue.slice(0, cursorPosition);
      const afterCursor = currentValue.slice(cursorPosition);
      const newValue = beforeCursor + '/' + afterCursor;

      inputRef.current.value = newValue;

      // 设置光标位置到 / 符号后面
      const newCursorPosition = cursorPosition + 1;
      inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);

      // 触发 input 事件,让 TypeAhead 监听到变化
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      inputRef.current.focus();
    }
  };

  // 暴露fillInput方法给父组件
  React.useEffect(() => {
    if (fillInputRef) {
      fillInputRef.current = fillInput;
    }
  }, [fillInput, fillInputRef]);

  // 计算框架初始化状态，供 useMemo 依赖
  const isOpenspecInitialized = isSpecFrameworkInitialized(
    SpecFramework.OpenSpec,
  );
  const isSpeckitInitialized = isSpecFrameworkInitialized(
    SpecFramework.SpecKit,
  );

  const currentSessionChatRepo = useMemo(() => {
    try {
      if (currentSession?.chat_repo) {
        return currentSession.chat_repo.trim();
      } else {
        return '';
      }
    } catch (err) {
      return '';
    }
  }, [currentSession?.chat_repo])

  const placeholder = React.useMemo(() => {
    if (currentSession?.is_favorite) {
      // 判断收藏会话类型和仓库匹配情况，生成不同的 __FAVORITE__ 协议字符串
      if (currentSession.chat_type === 'codebase') {
        const repoMatch =
          currentSessionChatRepo &&
          workspaceInfo.repoName &&
          currentSessionChatRepo === workspaceInfo.repoName;
        if (repoMatch) {
          return `__FAVORITE__codebase__收藏会话仅支持查看，不支持直接对话。如需继续对话，请点击「发起对话」，将自动携带上下文创建新会话`;
        }
        return `__FAVORITE__mismatch__${currentSessionChatRepo || ''}__该收藏会话关联仓库 ${currentSessionChatRepo}，请先打开对应仓库使用`;
      }
      return `__FAVORITE__default__收藏会话仅支持查看，不支持直接对话。如需继续对话，请点击「发起对话」，将自动携带上下文创建新会话`;
    }
    if (pluginApp) {
      return `${pluginApp.app_shortcut?.tip} (${config.submitKey})`;
    }
    if (chatType === 'codebase') {
      if (workspaceInfo.repoName) {
        if (
          currentSessionChatRepo &&
          currentSessionChatRepo !== workspaceInfo.repoName
        ) {
          return `当前会话关联仓库 ${currentSessionChatRepo}，打开该仓库使用或新建会话`;
        } else {
          // 检查是否需要初始化 - 显示可点击的提示，点击后打开初始化弹窗
          if (codebaseChatMode === 'openspec' && !isOpenspecInitialized) {
            return `__INIT_REQUIRED__openspec__openspec 环境未就绪，点击初始化`;
          }
          if (codebaseChatMode === 'speckit' && !isSpeckitInitialized) {
            return `__INIT_REQUIRED__speckit__speckit 环境未就绪，点击初始化`;
          }
          return `${config.submitKey} 发送`;
        }
      } else {
        if (currentSessionChatRepo) {
          return `当前会话关联仓库 ${currentSessionChatRepo}，打开该仓库后可继续对话`;
        } else {
          return `未识别到仓库信息，请打开代码仓库后使用本功能`;
        }
      }
    }
    if (attachs?.attachType === AttachType.CodeBase) {
      return `以"参考/搜索"开头引用代码地图内容，再发起提问。例如：搜索距离计算函数，生成计算两点距离的代码。${config.submitKey} 发送`;
    }
    if (attachs?.attachType === AttachType.NetworkModel) {
      return `${config.submitKey} 发送，/使用快捷指令`;
    }

    let _placeholder = `${config.submitKey} 发送， ${isMac ? 'Cmd' : 'Ctrl'} + ↑↓ 切换历史输入，/ 使用快捷指令，`;
    if (isDisabledAttachs) {
      _placeholder += '当前聊天模式不支持通过@引用其他内容';
    } else {
      _placeholder += '@引用知识';
    }
    return _placeholder;
  }, [
    pluginApp,
    chatType,
    attachs?.attachType,
    config.submitKey,
    isMac,
    isDisabledAttachs,
    workspaceInfo.repoName,
    currentSession,
    codebaseChatMode,
    isOpenspecInitialized,
    isSpeckitInitialized,
  ]);

  const renderTextArea = React.useMemo(() => {
    if (chatType === 'codebase') {
      let inputDisabled = false;
      if (!workspaceInfo.repoName) {
        inputDisabled = true;
      } else if (
        currentSessionChatRepo &&
        currentSessionChatRepo !== workspaceInfo.repoName
      ) {
        inputDisabled = true;
      } else if (
        // 选择 openspec/speckit 模式但未初始化时禁用输入
        codebaseChatMode === 'openspec' &&
        !isOpenspecInitialized
      ) {
        inputDisabled = true;
      } else if (codebaseChatMode === 'speckit' && !isSpeckitInitialized) {
        inputDisabled = true;
      }

      // 通过 placeholder 传递初始化提示，ChatMentionAreatext 内部渲染
      return (
        <ChatMentionAreatext
          inputRef={inputRef}
          disabled={inputDisabled}
          placeholder={placeholder}
          handlePaste={handlePaste}
          onKeyDown={handleInputKeyDown}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onChange={handleInputChange}
        />
      );
    } else {
      return (
        <ChatMentionAreatext
          inputRef={inputRef}
          placeholder={placeholder}
          handlePaste={handlePaste}
          onKeyDown={handleInputKeyDown}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onChange={handleInputChange}
        />
      );
    }
  }, [
    chatType,
    workspaceInfo.repoName,
    workspaceInfo.workspace,
    currentSessionChatRepo,
    codebaseChatMode,
    isOpenspecInitialized,
    isSpeckitInitialized,
    inputRef,
    placeholder,
    handlePaste,
    handleInputKeyDown,
    handleInputChange,
    setFocused,
  ]);

  return (
    <ChatTypeAhead
      innerElementRefs={[
        triggerPromptProtalRef,
        triggerMaskProtalRef,
        triggerPluginProtalRef,
      ]}
      ref={promptProtalRef}
      userInputRef={inputRef}
      uploadImgRef={uploadImgRef}
      onSubmit={handleSubmitWithTemplate}
    >
      <Box
        data-tour="chat-input"
        display="flex"
        flexDir="column"
        h="full"
        border="1px"
        borderRadius="8px"
        bg="questionsBgColor"
        borderColor={isFocused ? 'blue.300' : 'customBorder'}
        p="2"
        boxSizing="border-box"
      >
        <Box gap={2}>
          <ChatPluginAppRunner />
          <ChatMcpPromptRunner />
          <ChatSkillPromptRunner />
          <ChatAgentPromptRunner />
          <ChatPromptAppRunner />
          <ChatAttachs />
        </Box>
        {renderTextArea}
        <CodeChatInputActionBar
          triggerPromptProtalRef={triggerPromptProtalRef}
          triggerMaskProtalRef={triggerMaskProtalRef}
          handleTriggerPromptTemplate={handleTriggerPromptTemplate}
          tokenNumber={tokenNumber}
          triggerPluginProtalRef={triggerPluginProtalRef}
          promptProtalRef={promptProtalRef}
          uploadImgRef={uploadImgRef}
          onSend={submitChatInput}
          onStop={() => {
            stopRunningTerminal();
            onStreamStop();
            if (inputRef.current) {
              inputRef.current.focus();
              setFocused(true);
            }
          }}
        />
      </Box>
    </ChatTypeAhead>
  );
}

if (process.env.NODE_ENV === 'development') {
  (ChatInput as any).whyDidYouRender = true;
}

export default ChatInput;