import { ChatMessage } from '../../services';
import { ChatRole } from '../../types/chat';
import { ChatMessageHandle } from './ChatMessagesList/types';

/**
 * 计算所有用户消息的索引
 */
export const calculateUserMsgIndexes = (messages: ChatMessage[]): number[] => {
  const indexes: number[] = [];
  messages.forEach((msg, idx) => {
    if (msg.role === ChatRole.User && !msg.hidden) {
      indexes.push(idx);
    }
  });
  return indexes;
};

/**
 * 获取当前可视区域中的用户消息索引
 */
export const getCurrentVisibleUserMsgIdx = (params: {
  containerRef: React.RefObject<HTMLDivElement>;
  userMsgIndexes: number[];
  messages: ChatMessage[];
  currentUserMsgIdx: number;
  isScrolling: boolean;
}): number => {
  const { containerRef, userMsgIndexes, messages, currentUserMsgIdx, isScrolling } = params;

  // 如果正在滚动，直接返回 currentUserMsgIdx，避免在滚动动画期间获取错误的 DOM 位置
  if (isScrolling) {
    return currentUserMsgIdx;
  }

  const container = containerRef?.current;
  if (!container || userMsgIndexes.length === 0) {
    return currentUserMsgIdx;
  }

  // 先检查是否在底部
  const { scrollTop, scrollHeight, clientHeight } = container;
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;

  if (isAtBottom) {
    // 如果在底部，直接返回最后一条
    const lastIdx = userMsgIndexes.length - 1;
    return lastIdx;
  }

  // 获取容器的可视区域信息
  const containerRect = container.getBoundingClientRect();
  const containerTop = containerRect.top;
  const containerCenter = containerTop + containerRect.height * 0.3; // 在上方 30% 位置作为判断基准

  // 遍历所有 user 消息，找到最接近基准线的那条
  let closestIdx = -1;
  let minDistance = Infinity;
  let foundElements = 0;
  let visibleElements = 0;

  userMsgIndexes.forEach((msgIndex, idx) => {
    const msg = messages[msgIndex];
    if (!msg?.id) return;

    const element = document.getElementById(`user-message-${msg.id}`);
    if (!element) return;

    foundElements++;
    const elementRect = element.getBoundingClientRect();
    const elementTop = elementRect.top;

    // 计算元素顶部到基准线的距离
    const distance = Math.abs(elementTop - containerCenter);

    // 只考虑在可视区域内或接近可视区域的元素
    const isVisible = elementTop < containerRect.bottom && elementTop > containerTop - 200;
    if (isVisible) {
      visibleElements++;
      if (distance < minDistance) {
        minDistance = distance;
        closestIdx = idx;
      }
    }
  });

  // 如果没有找到可见元素，根据滚动位置判断是在顶部还是底部
  if (closestIdx === -1) {
    const isAtTop = scrollTop <= 50;

    // 如果找到了元素但都不可见，说明可能是分页加载导致的滚动位置错误
    // 这时应该信任 currentUserMsgIdx，而不是根据 scrollTop 判断
    if (foundElements > 0 && visibleElements === 0) {
      closestIdx = currentUserMsgIdx;
    } else if (isAtTop) {
      closestIdx = 0;
    } else {
      // 中间位置，使用 currentUserMsgIdx
      closestIdx = currentUserMsgIdx;
    }
  }

  return closestIdx;
};

/**
 * 滚动到指定用户消息
 */
export const scrollToUserMessage = (params: {
  targetIdx: number;
  userMsgIndexes: number[];
  messages: ChatMessage[];
  chatMessagesRef: React.RefObject<ChatMessageHandle>;
  onScrollStart: () => void;
  onScrollEnd: () => void;
  onUpdateCurrentIdx: (idx: number) => void;
}) => {
  const {
    targetIdx,
    userMsgIndexes,
    messages,
    chatMessagesRef,
    onScrollStart,
    onScrollEnd,
    onUpdateCurrentIdx,
  } = params;

  const msgIndex = userMsgIndexes[targetIdx];
  if (msgIndex === undefined) {
    return;
  }

  // 设置滚动标志
  onScrollStart();

  // 立即更新当前用户消息索引，避免在滚动动画期间获取到错误的值
  onUpdateCurrentIdx(targetIdx);

  const msg = messages[msgIndex];
  if (msg && msg.id && chatMessagesRef?.current) {
    chatMessagesRef.current.scrollToMessage('user', msg.id, '');
  }

  // 滚动动画 + 分页加载可能需要更长时间，延迟 1500ms 后清除标志
  setTimeout(() => {
    onScrollEnd();
  }, 1500);
};

/**
 * 检查是否可以上一组
 */
export const canGoPrev = (params: {
  userMsgIndexes: number[];
  containerRef: React.RefObject<HTMLDivElement>;
  messages: ChatMessage[];
  currentUserMsgIdx: number;
  isScrolling: boolean;
}): boolean => {
  const { userMsgIndexes } = params;
  if (userMsgIndexes.length <= 1) return false;
  const visibleIdx = getCurrentVisibleUserMsgIdx(params);
  return visibleIdx - 1 >= 0;
};

/**
 * 检查是否可以下一组
 */
export const canGoNext = (params: {
  userMsgIndexes: number[];
  containerRef: React.RefObject<HTMLDivElement>;
  messages: ChatMessage[];
  currentUserMsgIdx: number;
  isScrolling: boolean;
}): boolean => {
  const { userMsgIndexes } = params;
  if (userMsgIndexes.length <= 1) return false;
  const visibleIdx = getCurrentVisibleUserMsgIdx(params);
  return visibleIdx + 1 <= userMsgIndexes.length - 1;
};

/**
 * 滚动到底部
 */
export const scrollToBottom = (params: {
  containerRef: React.RefObject<HTMLDivElement>;
  userMsgIndexes: number[];
  onUpdateCurrentIdx: (idx: number) => void;
}) => {
  const { containerRef, userMsgIndexes, onUpdateCurrentIdx } = params;

  if (containerRef?.current) {
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
    // 更新当前用户消息索引为最后一条
    if (userMsgIndexes.length > 0) {
      onUpdateCurrentIdx(userMsgIndexes.length - 1);
    }
  }
};
