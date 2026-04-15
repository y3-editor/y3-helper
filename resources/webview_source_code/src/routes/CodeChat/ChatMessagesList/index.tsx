import * as React from 'react';
import { Button } from '@chakra-ui/react';
import { useChatStore } from '../../../store/chat';
import { ChatMessageHandle, ChatMessageProps, ChatRole, ChatFeedbackType, RenderMessage } from './types';
import { ChatMessage } from '../../../services';
import { GroupAIMessage } from './GroupAIMessage';
import UserMessage from './UserMessage';
import FeedbackPanel from './FeedbackPanel';
import StreamingChatMessage from './StreamingChatMessage';
import { usePanelContextOptional } from '../../../context/PanelContext';
import { useChatStreamNotification } from '../../../hooks/useChatStreamNotification';

const PAGE_SIZE = 30;

const ChatMessagesList = React.forwardRef<ChatMessageHandle, ChatMessageProps>(
  (props: ChatMessageProps, ref) => {
    const { containerRef, userScrollLock, onFeedback, isShare, selectedMessageIds, onToggleMessage } = props;
    const currentSession = useChatStore((state) => state.currentSession());
    const isError = useChatStore((state) => state.isError);
    const prevSessionId = React.useRef<string>();
    const abortControllerRef = React.useRef<AbortController | null>(null);

    // 获取 panelId 并监听流状态变化，通知插件端
    const panelContext = usePanelContextOptional();
    const panelId = panelContext?.panelId || '';
    useChatStreamNotification(panelId);
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
        abortControllerRef.current?.abort();
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

    const handleLoadPrevMessages = React.useCallback(() => {
      if (!messagesRef.current) {
        return;
      }
      const topOffset = 80;
      const previousScrollHeight = messagesRef.current?.scrollHeight;
      setPage((prev) => (prev += 1));

      requestAnimationFrame(() => {
        if (!containerRef?.current) {
          return;
        }
        const newScrollTop =
          containerRef.current?.scrollHeight - previousScrollHeight - topOffset;
        containerRef.current.scrollTo({ top: newScrollTop });
      });
    }, [containerRef]);

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
      };
    });

    const findMessageRange = React.useCallback(
      (messageId: string) => {
        return getMessageRangeById(messagePool, messageId);
      },
      [messagePool],
    );

    const submitMessageFeedback = React.useCallback(
      (messageId: string, feedbackType: ChatFeedbackType) => {
        if (!currentSession?._id) return;
        const messageRange = findMessageRange(messageId);
        const feedbackDetail = {
          topic: currentSession?.topic || '',
          chat_type: currentSession?.chat_type || '',
          chat_repo: currentSession?.chat_repo || '',
          messages: messageRange,
          message_id: messageId,
          session_id: currentSession?._id,
          feedback: '',
          feedback_type: feedbackType,
        };
        onFeedback?.(feedbackDetail);
      },
      [
        onFeedback,
        currentSession?._id,
        findMessageRange,
        currentSession?.topic,
        currentSession?.chat_type,
        currentSession?.chat_repo,
      ],
    );

    const handleCodeBaseFeedback = React.useCallback(
      (feedbackType: ChatFeedbackType) => {
        if (!currentSession?._id) return;
        const latestMessage =
          currentSession?.data?.messages[
            currentSession?.data.messages.length - 1
          ];
        if (latestMessage?.id) {
          const messageRange = findMessageRange(latestMessage?.id);
          const feedbackDetail = {
            topic: currentSession?.topic || '',
            chat_type: currentSession?.chat_type || '',
            chat_repo: currentSession?.chat_repo || '',
            messages: messageRange,
            message_id: latestMessage?.id,
            session_id: currentSession?._id,
            feedback: '',
            feedback_type: feedbackType,
          };
          onFeedback?.(feedbackDetail);
        }
      },
      [currentSession, onFeedback, findMessageRange],
    );

    return (
      <div className="chat-message">
        {offset > 0 && (
          <Button
            variant="link"
            className="w-full mb-4"
            onClick={handleLoadPrevMessages}
          >
            更多历史消息
          </Button>
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
              return (
                <div key={messageId} id={`user-message-${message.id}`}>
                  <UserMessage
                    {...props}
                    message={message}
                    isShare={isShare}
                    selectedMessageIds={selectedMessageIds}
                    onToggleMessage={onToggleMessage}
                  />
                </div>
              );
            }

            if (isAssistant && message.messages?.length) {
              return (
                <div key={messageId} id={messageId}>
                  <GroupAIMessage
                    messages={message.messages || []}
                    isLatest={isLatestMessage}
                    attachs={userAttachs}
                    onFeedback={(feedbackType) => {
                      if (message.messages) {
                        const lastMessage = message.messages[message.messages.length-1];
                        if (lastMessage.id) {
                          submitMessageFeedback(lastMessage.id, feedbackType);
                        } else if (message.id) {
                          submitMessageFeedback(message.id, feedbackType);
                        }
                      }
                      if (message.id) {
                        submitMessageFeedback(message.id, feedbackType);
                      }
                    }}
                    isShare={isShare}
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
        {!isShare ? (
          <>
            {isError ? (
              null
            ) : (
              <FeedbackPanel
                userScrollLock={userScrollLock ? userScrollLock : false}
                onCodeBaseFeedback={handleCodeBaseFeedback}
                submitMessageFeedback={submitMessageFeedback}
              />
            )}
          </>
        ) : null}
      </div>
    );
  },
);

const getMessageRangeById = (messages: ChatMessage[], messageId: string) => {
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) return [];
  return messages.slice(0, index + 1);
};


export { StreamingChatMessage }

export type { ChatMessageHandle }

export default ChatMessagesList;
