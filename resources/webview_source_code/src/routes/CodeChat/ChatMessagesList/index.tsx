import * as React from 'react';
import { Button, Box, Spinner, useColorModeValue } from '@chakra-ui/react';
import { useChatStore } from '../../../store/chat';
import { ChatMessageHandle, ChatMessageProps, ChatRole, RenderMessage } from './types';
import { ChatMessage } from '../../../services';
import { GroupAIMessage } from './GroupAIMessage';
import UserMessage from './UserMessage';
import StreamingChatMessage from './StreamingChatMessage';
import { usePanelContextOptional } from '../../../context/PanelContext';
import { useChatStreamNotification } from '../../../hooks/useChatStreamNotification';
import { ABORT_REASON_CLEANUP, createAbortReason } from '../../../utils/abort';

const PAGE_SIZE = 30;

const ChatMessagesList = React.forwardRef<ChatMessageHandle, ChatMessageProps>(
  (props: ChatMessageProps, ref) => {
    const { containerRef, isShare, selectedMessageIds, onToggleMessage, toolCallRoundIds, onToggleToolCallRound } = props;
    const currentSession = useChatStore((state) => state.currentSession());
    // 选中会话组的背景色（浅/深色主题自适应）
    const selectedGroupBg = useColorModeValue('rgba(120, 111, 255, 0.1)', 'rgba(43, 45, 46, 0.5)');
    const prevSessionId = React.useRef<string>();
    const abortControllerRef = React.useRef<AbortController | null>(null);

    // 获取 panelId 和 mode 并监听流状态变化，通知插件端
    const panelContext = usePanelContextOptional();
    const panelId = panelContext?.panelId;
    const mode = panelContext?.mode;
    useChatStreamNotification(panelId, mode);
    const [page, setPage] = React.useState(0);  // 历史消息分页，用于折叠和加载更多
    const messagesRef = React.useRef<HTMLDivElement>(null);
    const messagePool = React.useMemo(() => {
      return currentSession?.data?.messages || []
    }, [currentSession?.data?.messages])  // 历史消息池
    const length = messagePool.length;

    // 用来判断是否允许加载更多
    const offset = React.useMemo(() => {
      const nums = (page + 1) * PAGE_SIZE;
      return nums < length ? length - nums : 0;
    }, [length, page]);

    const start = Math.max(0, messagePool.length - (page + 1) * PAGE_SIZE);

    React.useEffect(() => {
      abortControllerRef.current = new AbortController();
      return () => {
        abortControllerRef.current?.abort(createAbortReason(ABORT_REASON_CLEANUP, __ABORT_LOC__));
      };
    }, []);

    const renderMessages: RenderMessage[] = React.useMemo(
      () => {
        const slicedMessage = messagePool.slice(start, length);
        let currentGroup: ChatMessage[] = [];
        const result = []
        for (const msg of slicedMessage) {
          if (msg.role === ChatRole.User) {
            if (currentGroup.length) {
              result.push({
                ...currentGroup[0],
                messages: currentGroup
              })
            }
            currentGroup = [];
            result.push(msg);
          } else if (msg.role === ChatRole.Assistant) {
            currentGroup.push(msg);
          }
        }
        if (currentGroup.length) {
          result.push({
            ...currentGroup[0],
            messages: currentGroup
          })
        }
        return result;
      },
      [messagePool, start, length],
    );

    const isLoadingMoreRef = React.useRef(false);
    const sentinelRef = React.useRef<HTMLDivElement>(null);

    const handleLoadPrevMessages = React.useCallback(() => {
      if (!messagesRef.current || isLoadingMoreRef.current) {
        return;
      }
      isLoadingMoreRef.current = true;
      const topOffset = 80;
      const previousScrollHeight = messagesRef.current?.scrollHeight;
      setPage((prev) => (prev += 1));

      requestAnimationFrame(() => {
        if (!containerRef?.current) {
          isLoadingMoreRef.current = false;
          return;
        }
        const newScrollTop =
          containerRef.current?.scrollHeight - previousScrollHeight - topOffset;
        containerRef.current.scrollTo({ top: newScrollTop });
        // 延迟重置 loading 状态，等待渲染稳定
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, 300);
      });
    }, [containerRef]);

    // IntersectionObserver 自动展开历史消息
    React.useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel || offset <= 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !isLoadingMoreRef.current) {
            handleLoadPrevMessages();
          }
        },
        {
          root: containerRef?.current || null,
          threshold: 0.1,
        },
      );

      observer.observe(sentinel);
      return () => {
        observer.disconnect();
      };
    }, [offset, handleLoadPrevMessages, containerRef]);

    React.useEffect(
      function resetPage() {
        setPage(0);
      },
      [currentSession?._id],
    );

    React.useEffect(() => {
      if (currentSession?._id !== prevSessionId.current) {
        requestAnimationFrame(() => {
          containerRef?.current?.scrollTo({
            top: containerRef.current?.scrollHeight,
            behavior: 'auto',
          });
        });
      }
      prevSessionId.current = currentSession?._id;
    }, [containerRef, currentSession?._id]);

    const highlightSearchContent = React.useCallback(
      (messageElement: HTMLElement, keyword: string) => {
        if (!messageElement || !abortControllerRef.current) return;

        const signal = abortControllerRef.current.signal;

        const highlight = () => {
          if (signal.aborted) return;

          const oldHighlights =
            messageElement.querySelectorAll('.search-highlight');
          oldHighlights.forEach((highlight) => {
            const parent = highlight.parentNode;
            if (parent) {
              parent.replaceChild(
                document.createTextNode(highlight.textContent || ''),
                highlight,
              );
              parent.normalize();
            }
          });

          const walker = document.createTreeWalker(
            messageElement,
            NodeFilter.SHOW_TEXT,
            null,
          );

          const regex = new RegExp(keyword, 'gi');
          let node;
          while ((node = walker.nextNode()) && !signal.aborted) {
            const text = node.textContent;
            if (text && regex.test(text)) {
              const fragment = document.createDocumentFragment();
              let lastIndex = 0;
              text.replace(regex, (match, index) => {
                if (index > lastIndex) {
                  fragment.appendChild(
                    document.createTextNode(text.slice(lastIndex, index)),
                  );
                }
                const span = document.createElement('span');
                span.classList.add('search-highlight');
                span.textContent = match;
                fragment.appendChild(span);
                lastIndex = index + match.length;
                return match;
              });
              if (lastIndex < text.length) {
                fragment.appendChild(
                  document.createTextNode(text.slice(lastIndex)),
                );
              }
              node.parentNode?.replaceChild(fragment, node);
            }
          }
        };

        requestAnimationFrame(highlight);
      },
      [],
    );

    const scrollToMessage = React.useCallback(
      (role: string, id: string, keyword: string) => {
        if (!abortControllerRef.current) {
          return;
        }

        const signal = abortControllerRef.current.signal;

        const messageIndex = messagePool.findIndex(
          (message) => message.id === id,
        );

        if (messageIndex === -1) {
          return;
        }

        const pageIndex = Math.floor(
          (messagePool.length - messageIndex - 1) / PAGE_SIZE,
        );

        setPage(pageIndex);
        if (!messagesRef.current) {
          return;
        }

        // 增加延迟时间，确保分页加载和渲染完成
        setTimeout(() => {
          if (signal.aborted) {
            return;
          }

          const messageElement = document.getElementById(
            `${role}-message-${id}`,
          );

          if (messageElement) {
            // 如果有 containerRef，使用它来滚动（适用于 Modal）
            if (containerRef?.current) {
              const container = containerRef.current;

              // 直接使用 offsetTop 获取元素相对于其 offsetParent 的位置
              // 需要递归计算到滚动容器为止
              let elementTop = 0;
              let currentElement = messageElement as HTMLElement | null;

              while (currentElement && currentElement !== container) {
                elementTop += currentElement.offsetTop;
                currentElement = currentElement.offsetParent as HTMLElement | null;

                // 如果找到了容器，停止
                if (currentElement === container) {
                  break;
                }
              }

              // const elementHeight = messageElement.offsetHeight;

              // 容器可视高度
              const containerHeight = container.clientHeight;
              const containerScrollHeight = container.scrollHeight;

              // 计算目标滚动位置
              // 尝试将元素放在可视区域的 1/4 位置（顶部留出 25% 空间）
              let targetScrollTop = elementTop - containerHeight * 0.25;

              // 处理边界情况
              // 如果滚动到底部还不够，就尽量滚到底
              const maxScrollTop = containerScrollHeight - containerHeight;
              targetScrollTop = Math.min(targetScrollTop, maxScrollTop);

              // 确保不会滚动到负数
              targetScrollTop = Math.max(0, targetScrollTop);

              container.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth',
              });
            } else {
              // 默认行为 - 使用 scrollIntoView 的 nearest 选项
              messageElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              });
            }
            setTimeout(() => {
              if (!signal.aborted) {
                highlightSearchContent(messageElement, keyword);
              }
            }, 100);
          }
        }, 500);
      },
      [messagePool, highlightSearchContent, containerRef],
    );

    const removeAllHighlights = React.useCallback(() => {
      if (!abortControllerRef.current || !messagesRef.current) return;
      const signal = abortControllerRef.current.signal;
      const removeHighlights = () => {
        if (signal.aborted || !messagesRef.current) return;

        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              mutation.removedNodes.forEach((node) => {
                if (
                  node.nodeType === Node.ELEMENT_NODE &&
                  (node as Element).classList.contains('search-highlight')
                ) {
                  const parent = mutation.target;
                  if (parent.nodeType === Node.ELEMENT_NODE) {
                    (parent as Element).normalize();
                  }
                }
              });
            }
          });
        });

        observer.observe(messagesRef.current, {
          childList: true,
          subtree: true,
        });

        const highlights =
          messagesRef.current.querySelectorAll('.search-highlight');
        highlights.forEach((highlight) => {
          const parent = highlight.parentNode;
          if (parent) {
            parent.replaceChild(
              document.createTextNode(highlight.textContent || ''),
              highlight,
            );

            if (
              parent.nodeName === 'SPAN' &&
              parent.childNodes.length === 1 &&
              parent.parentNode
            ) {
              if (parent.firstChild) {
                parent.parentNode.replaceChild(parent.firstChild, parent);
              }
            }
          }
        });

        if (messagesRef.current) {
          messagesRef.current.normalize();
        }
        observer.disconnect();
      };

      if (window.requestIdleCallback) {
        window.requestIdleCallback(removeHighlights);
      } else {
        setTimeout(removeHighlights, 0);
      }
    }, []);

    // 展开全部历史分页
    const expandAllPages = React.useCallback(() => {
      const totalPages = Math.ceil(messagePool.length / PAGE_SIZE) - 1;
      if (totalPages > 0) {
        setPage(totalPages);
      }
    }, [messagePool.length]);

    React.useImperativeHandle(ref, () => {
      return {
        scrollToPage: (index: number) => {
          const pageIndex = Math.floor(
            (messagePool.length - index - 1) / PAGE_SIZE,
          );
          setPage(pageIndex);
        },
        scrollToMessage,
        removeAllHighlights,
        expandAllPages,
      };
    });

    return (
      <div className="chat-message">
        {offset > 0 && (
          <div
            ref={sentinelRef}
            className="w-full mb-4 flex justify-center"
          >
            <Button
              variant="link"
              onClick={handleLoadPrevMessages}
              isLoading={isLoadingMoreRef.current}
              spinner={<Spinner size="sm" />}
            >
              更多历史消息
            </Button>
          </div>
        )}
        <div ref={messagesRef}>
          {renderMessages.map((message, index) => {
            const isUser = message.role === ChatRole.User;
            const isAssistant = message.role === ChatRole.Assistant;
            const isLatestMessage = index == renderMessages.length - 1;
            const messageId = `${message.role}-message-${message.id}`;
            const userAttachs = renderMessages.filter(
              (i) => i.id === message.id && i.role === ChatRole.User,
            )[0]?.attachs || [];

            if (isUser && !message.hidden) {
              const isGroupSelected = !!message.id && !!selectedMessageIds?.has(message.id);
              return (
                <Box
                  key={messageId}
                  id={`user-message-${message.id}`}
                  bg={isGroupSelected ? selectedGroupBg : undefined}
                  borderRadius="6px"
                  px={2}
                  py={1}
                  transition="background 0.2s, border-color 0.2s"
                >
                  <UserMessage
                    {...props}
                    message={message}
                    isShare={isShare}
                    selectedMessageIds={selectedMessageIds}
                    onToggleMessage={onToggleMessage}
                  />
                </Box>
              );
            }

            if (isAssistant && message.messages?.length) {
      // 向前查找最近一条 User 消息 ID（用于收藏模式）
              const prevUserMsg = renderMessages.slice(0, index).reverse().find(
                (m) => m.role === ChatRole.User,
              );
              // AI 完成时间取最后一条 assistant 子消息的 createdAt
              const lastSubMsg = message.messages[message.messages.length - 1];
              const prevUserMsgId = prevUserMsg?.id;
              const isGroupSelected = !!prevUserMsgId && !!selectedMessageIds?.has(prevUserMsgId);
              return (
                <Box
                  key={messageId}
                  id={messageId}
                  bg={isGroupSelected ? selectedGroupBg : undefined}
                  px={2}
                  py={1}
                  transition="background 0.2s, border-color 0.2s"
                >
                  <GroupAIMessage
                    messages={message.messages || []}
                    isLatest={isLatestMessage}
                    attachs={userAttachs}
                    sentAt={prevUserMsg?.createdAt}
                    completedAt={lastSubMsg?.createdAt}
                    isShare={isShare}
                    userMsgId={prevUserMsgId}
                    isToolCallSelected={prevUserMsgId ? toolCallRoundIds?.has(prevUserMsgId) : false}
                    onToggleToolCallRound={onToggleToolCallRound}
                    isUserMsgSelected={prevUserMsgId ? selectedMessageIds?.has(prevUserMsgId) ?? false : false}
                  />
                </Box>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  },
);



export { StreamingChatMessage }

export type { ChatMessageHandle }

export default ChatMessagesList;