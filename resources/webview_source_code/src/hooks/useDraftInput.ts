import { useEffect, useRef, useCallback } from 'react';
import { ChatType } from '../store/chat';

const DRAFT_INPUT_KEY_PREFIX = 'codemaker-draft-input-';
const DEBOUNCE_DELAY = 500; // 防抖延迟时间（毫秒）

/**
 * 自定义 Hook：管理不同 chatType 的输入框草稿内容
 *
 * 功能：
 * 1. 在 chatType 切换时自动保存当前输入内容
 * 2. 切换回原 chatType 时自动恢复之前的输入内容
 * 3. 发送消息后清空对应 chatType 的草稿
 * 4. 等待仓库加载完成后再恢复草稿（避免被仓库加载重置）
 * 5. 输入框变化时自动保存（带防抖）
 */
export const useDraftInput = (
  chatType: ChatType,
  inputRef: React.RefObject<HTMLTextAreaElement | null>,
  workspaceReady?: boolean // 新增参数：仓库是否已加载完成
) => {
  // 使用 ref 记录上一次的 chatType，用于在切换时保存内容
  const prevChatTypeRef = useRef<ChatType>(chatType);
  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 标记是否已经初始化过
  const hasInitializedRef = useRef<boolean>(false);
  // 记录上一次的 workspaceReady 状态
  const prevWorkspaceReadyRef = useRef<boolean>(workspaceReady ?? false);
  // 恢复草稿的延迟定时器
  const restoreTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 保存草稿到 localStorage
  const saveDraft = (type: ChatType, content: string) => {
    try {
      if (content.trim()) {
        localStorage.setItem(`${DRAFT_INPUT_KEY_PREFIX}${type}`, content);
      } else {
        // 如果内容为空，删除缓存
        localStorage.removeItem(`${DRAFT_INPUT_KEY_PREFIX}${type}`);
      }
    } catch (error) {
      console.warn('[useDraftInput] Failed to save draft:', error);
    }
  };

  // 从 localStorage 获取草稿
  const getDraft = (type: ChatType): string => {
    try {
      return localStorage.getItem(`${DRAFT_INPUT_KEY_PREFIX}${type}`) || '';
    } catch (error) {
      console.warn('[useDraftInput] Failed to get draft:', error);
      return '';
    }
  };

  // 清空指定 chatType 的草稿
  const clearDraft = (type?: ChatType) => {
    try {
      const targetType = type || chatType;
      localStorage.removeItem(`${DRAFT_INPUT_KEY_PREFIX}${targetType}`);
    } catch (error) {
      console.warn('[useDraftInput] Failed to clear draft:', error);
    }
  };

  // 手动保存当前输入内容（用于实时保存）
  const saveCurrentDraft = useCallback(() => {
    if (inputRef.current) {
      saveDraft(chatType, inputRef.current.value);
    }
  }, [chatType, inputRef]);

  // 防抖保存函数
  const debouncedSave = useCallback(() => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的定时器
    debounceTimerRef.current = setTimeout(() => {
      saveCurrentDraft();
    }, DEBOUNCE_DELAY);
  }, [saveCurrentDraft]);

  // 监听 chatType 变化，实现自动保存和恢复
  useEffect(() => {
    const prevChatType = prevChatTypeRef.current;
    const prevWorkspaceReady = prevWorkspaceReadyRef.current;
    const currentWorkspaceReady = workspaceReady ?? true; // 如果未传递，默认认为已就绪

    if (!inputRef.current) return;

    // 清除之前的恢复定时器
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }

    // 场景1：chatType 发生变化
    if (prevChatType !== chatType) {
      // 1. 保存之前 chatType 的输入内容
      const prevContent = inputRef.current.value;
      if (prevContent) {
        saveDraft(prevChatType, prevContent);
      }

      // 2. 恢复当前 chatType 的草稿内容（需要等待仓库就绪）
      if (currentWorkspaceReady) {
        const currentDraft = getDraft(chatType);
        // 延迟恢复，确保在所有其他操作之后执行
        restoreTimerRef.current = setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.value = currentDraft;
          }
        }, 100);
        hasInitializedRef.current = true;
      } else {
        // 仓库未就绪，先清空，等待仓库就绪后再恢复
        hasInitializedRef.current = false;
      }

      // 更新 chatType ref
      prevChatTypeRef.current = chatType;
    }
    // 场景2：仓库从未就绪变为就绪（首次加载或切换仓库后加载完成）
    else if (!prevWorkspaceReady && currentWorkspaceReady && !hasInitializedRef.current) {
      const currentDraft = getDraft(chatType);
      // 延迟恢复，确保在所有其他操作之后执行
      restoreTimerRef.current = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.value = currentDraft;
        }
      }, 100);
      hasInitializedRef.current = true;
    }
    // 场景3：仓库从就绪变为未就绪（切换仓库）
    else if (prevWorkspaceReady && !currentWorkspaceReady) {
      // 保存当前内容
      const currentContent = inputRef.current.value;
      if (currentContent) {
        saveDraft(chatType, currentContent);
      }
      // 重置初始化标记，等待新仓库加载
      hasInitializedRef.current = false;
    }

    // 更新 workspaceReady ref
    prevWorkspaceReadyRef.current = currentWorkspaceReady;

    // 清理函数
    return () => {
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
      }
    };
  }, [chatType, inputRef, workspaceReady]);

  // 监听输入框变化，自动保存草稿
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const handleInput = () => {
      debouncedSave();
    };

    // 添加 input 事件监听
    textarea.addEventListener('input', handleInput);

    // 清理函数
    return () => {
      textarea.removeEventListener('input', handleInput);
      // 清除防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputRef, debouncedSave]);

  return {
    getDraft,
    saveDraft,
    clearDraft,
    saveCurrentDraft,
  };
};