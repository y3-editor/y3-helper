import { useEffect, useRef } from 'react';
import { ChatType } from '../store/chat';

const DRAFT_INPUT_KEY_PREFIX = 'y3maker-draft-input-';

/**
 * 自定义 Hook：管理不同 chatType 的输入框草稿内容
 *
 * 功能：
 * 1. 在 chatType 切换时自动保存当前输入内容
 * 2. 切换回原 chatType 时自动恢复之前的输入内容
 * 3. 发送消息后清空对应 chatType 的草稿
 */
export const useDraftInput = (
  chatType: ChatType,
  inputRef: React.RefObject<HTMLTextAreaElement | null>
) => {
  // 使用 ref 记录上一次的 chatType，用于在切换时保存内容
  const prevChatTypeRef = useRef<ChatType>(chatType);

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
  const saveCurrentDraft = () => {
    if (inputRef.current) {
      saveDraft(chatType, inputRef.current.value);
    }
  };

  // 监听 chatType 变化，实现自动保存和恢复
  useEffect(() => {
    const prevChatType = prevChatTypeRef.current;

    // 如果 chatType 发生变化
    if (prevChatType !== chatType && inputRef.current) {
      // 1. 保存之前 chatType 的输入内容
      const prevContent = inputRef.current.value;
      if (prevContent) {
        saveDraft(prevChatType, prevContent);
      }

      // 2. 恢复当前 chatType 的草稿内容
      const currentDraft = getDraft(chatType);
      inputRef.current.value = currentDraft;

      // 更新 ref
      prevChatTypeRef.current = chatType;
    }
  }, [chatType, inputRef]);

  // 组件首次挂载时恢复草稿
  useEffect(() => {
    if (inputRef.current && !inputRef.current.value) {
      const currentDraft = getDraft(chatType);
      if (currentDraft) {
        inputRef.current.value = currentDraft;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在首次挂载时执行

  return {
    getDraft,
    saveDraft,
    clearDraft,
    saveCurrentDraft,
  };
};
