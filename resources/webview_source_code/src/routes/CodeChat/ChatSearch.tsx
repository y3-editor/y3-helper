import * as React from 'react';
import { IconButton, Input, Box, Tooltip } from '@chakra-ui/react';
import Icon from '../../components/Icon';
import {
  IoSearchSharp,
  IoClose,
  IoChevronUp,
  IoChevronDownSharp,
} from 'react-icons/io5';
import { debounce } from 'lodash';
import MiniSearch from 'minisearch';
import { useChatStore, useChatStreamStore } from '../../store/chat';
import { ChatMessageContent } from '../../services/index';
import { isMacOS } from '../../utils';
import { useCodeChatContext } from './CodeChatProvider';

interface SearchNode {
  node: Node;
  index: number;
  id: string;
}
interface SearchMessageResult {
  messageIndex: number;
  messageId: string; // 添加消息ID
  contentIndex: number;
}

interface MessageDocument {
  id: string;
  messageIndex: number;
  messageId: string; // 实际的消息ID
  content: string;
  role: string;
}

/**
 * ChatSearch 组件
 * 直接渲染搜索按钮（用于内联在 toolbar flex 布局中）
 * 通过 CodeChatContext 获取 chatMessagesRef 和 chatContextRef
 */
const ChatSearch = () => {
  // 通过 Context 获取 chatMessagesRef 和 chatContextRef
  const { chatMessagesRef, chatContextRef } = useCodeChatContext();

  const [showSearch, setShowSearch] = React.useState(false);
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = React.useState<SearchNode[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(-1);
  const currentSession = useChatStore((state) => state.currentSession());
  const [searchMessageResult, setSearchMessageResult] = React.useState<
    SearchMessageResult[]
  >([]);
  const isMac = isMacOS();
  const [isFocused, setIsFocused] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false); // 添加搜索中状态

  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isTerminalProcessing = useChatStreamStore((state) => state.isTerminalProcessing);

  // MiniSearch 实例
  const miniSearchRef = React.useRef<MiniSearch<MessageDocument> | null>(null);
  const lastSessionIdRef = React.useRef<string | undefined>(undefined);
  const lastMessageCountRef = React.useRef<number>(0);

  const disabled = React.useMemo(() => {
    return isStreaming || isProcessing || isTerminalProcessing || isSearching;
  }, [isStreaming, isProcessing, isTerminalProcessing, isSearching]);


  // 构建搜索索引 - 支持增量更新
  const buildSearchIndex = React.useCallback(() => {
    const messagePool = currentSession?.data?.messages || [];
    const currentMessageCount = messagePool.length;

    // 会话切换，重建索引
    if (currentSession?._id !== lastSessionIdRef.current) {
      // 创建 MiniSearch 实例
      const miniSearch = new MiniSearch<MessageDocument>({
        fields: ['content'], // 索引字段
        storeFields: ['messageIndex', 'content', 'role'], // 存储字段
        searchOptions: {
          boost: { content: 2 },
          fuzzy: 0.2, // 模糊搜索
          prefix: true, // 前缀搜索
        },
      });

      // 准备文档数据
      const documents: any = messagePool.map((message, index) => {
        let content = '';
        if (message.content instanceof Array) {
          content =
            message.content.find((i) => i.type === ChatMessageContent.Text)
              ?.text || '';
        } else {
          content = message.content;
        }

        return {
          id: `${index}`,
          messageIndex: index,
          messageId: message.id, // 保存实际的消息ID
          content,
          role: message.role,
        };
      });

      // 批量添加文档到索引
      miniSearch.addAll(documents);

      miniSearchRef.current = miniSearch;
      lastSessionIdRef.current = currentSession?._id;
      lastMessageCountRef.current = currentMessageCount;
    }
    // 消息增加，增量更新
    else if (
      miniSearchRef.current &&
      currentMessageCount > lastMessageCountRef.current
    ) {
      const newMessages = messagePool.slice(lastMessageCountRef.current);
      const newDocuments: any = newMessages.map((message, idx) => {
        const index = lastMessageCountRef.current + idx;
        let content = '';
        if (message.content instanceof Array) {
          content =
            message.content.find((i) => i.type === ChatMessageContent.Text)
              ?.text || '';
        } else {
          content = message.content;
        }

        return {
          id: `${index}`,
          messageIndex: index,
          messageId: message.id, // 保存实际的消息ID
          content,
          role: message.role,
        };
      });

      // 增量添加新消息到索引
      miniSearchRef.current.addAll(newDocuments);
      lastMessageCountRef.current = currentMessageCount;
    }
  }, [currentSession?.data?.messages, currentSession?._id]);

  // 当会话或消息变化时更新索引
  React.useEffect(() => {
    const messagePool = currentSession?.data?.messages || [];
    const shouldUpdate =
      currentSession?._id !== lastSessionIdRef.current ||
      messagePool.length !== lastMessageCountRef.current;

    if (shouldUpdate) {
      buildSearchIndex();
    }
  }, [currentSession?._id, currentSession?.data?.messages.length, buildSearchIndex, currentSession?.data?.messages]);

  const resetHighlights = React.useCallback(() => {
    const contentElement = chatContextRef.current;
    if (contentElement) {
      const previousHighlights =
        contentElement.querySelectorAll('.search-highlight');
      previousHighlights.forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(
            document.createTextNode(el.textContent || ''),
            el,
          );
          parent.normalize();
        }
      });
    }
  }, [chatContextRef]);

  const highlightResult = React.useCallback(
    (result: SearchNode) => {
      if (!result) return;
      const contentElement = chatContextRef.current;
      if (contentElement) {
        const highlightedElement =
          contentElement.querySelector('.current-highlight');
        if (highlightedElement) {
          highlightedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    },
    [chatContextRef],
  );

  const updateHighlights = React.useCallback(
    (results: SearchNode[]) => {
      resetHighlights();

      // 限制高亮数量，最多200个，避免DOM操作过多
      const limitedResults = results.slice(0, 200);

      limitedResults.forEach((result, index) => {
        if (result.node.nodeType === Node.TEXT_NODE) {
          const nodeContent = result.node.textContent;
          if (nodeContent && result.index < nodeContent.length) {
            const endIndex = Math.min(
              result.index + searchKeyword.length,
              nodeContent.length,
            );
            const range = document.createRange();
            range.setStart(result.node, result.index);
            range.setEnd(result.node, endIndex);

            const span = document.createElement('span');
            span.classList.add('search-highlight');
            span.id = `search-highlight-${result.id}`;
            if (index === 0) {
              span.classList.add('current-highlight');
            }
            range.surroundContents(span);
          }
        }
      });

      if (limitedResults.length > 0) {
        highlightResult(limitedResults[0]);
        setCurrentIndex(0);
      }
    },
    [searchKeyword, resetHighlights, highlightResult],
  );

  const performSearch = React.useCallback(() => {
    const contentElement = chatContextRef.current;
    if (!searchKeyword.trim() || !contentElement) return;

    resetHighlights();

    const walker = document.createTreeWalker(
      contentElement,
      NodeFilter.SHOW_TEXT,
      null,
    );
    const searchNodes: SearchNode[] = [];
    let node;
    let nodeId = 0;
    const keywordLower = searchKeyword.toLowerCase();

    while ((node = walker.nextNode())) {
      if (!node || !node.nodeValue) continue;
      const nodeValue = node.nodeValue.toLowerCase();
      let index = nodeValue.indexOf(keywordLower);
      while (index !== -1) {
        searchNodes.push({ node, index, id: `${nodeId}-${index}` });
        index = nodeValue.indexOf(keywordLower, index + 1);
        nodeId++;
      }
    }
    const reverseSearchNode = searchNodes.reverse();
    setSearchResults(reverseSearchNode);
    updateHighlights(reverseSearchNode);
  }, [searchKeyword, resetHighlights, updateHighlights, chatContextRef]);

  const handleSearch = React.useCallback(
    (searchKeyword: string) => {
      if (!searchKeyword.trim()) {
        setSearchResults([]);
        setCurrentIndex(-1);
        resetHighlights();
        setSearchMessageResult([]);
        setIsSearching(false);
        return;
      }

      // 最小搜索长度限制
      if (searchKeyword.trim().length < 2) {
        setIsSearching(false);
        return;
      }

      // 开始搜索
      setIsSearching(true);

      // 确保索引已构建
      if (!miniSearchRef.current) {
        buildSearchIndex();
        if (!miniSearchRef.current) {
          setIsSearching(false);
          return;
        }
      }

      const keyword = searchKeyword.trim();

      try {
        // 使用 MiniSearch 进行快速搜索
        const searchResults = miniSearchRef.current.search(keyword, {
          fuzzy: 0.2,
          prefix: true,
        });

        // 转换为 SearchMessageResult 格式
        const results: SearchMessageResult[] = [];
        searchResults.forEach((result) => {
          const messageIndex = result.messageIndex;
          const messageId = result.messageId;
          const content = result.content.toLowerCase();
          const keywordLower = keyword.toLowerCase();

          let startIndex = 0;
          while (startIndex < content.length) {
            const contentIndex = content.indexOf(keywordLower, startIndex);
            if (contentIndex === -1) break;

            results.push({
              messageIndex,
              messageId,
              contentIndex,
            });

            startIndex = contentIndex + keyword.length;
          }
        });

        setCurrentIndex(-1);
        setSearchMessageResult(results);

        if (results.length > 0) {
          const findMinIndex = Math.min(
            ...results.map((result) => result.messageIndex),
          );
          if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollToPage(findMinIndex);
            setTimeout(() => {
              performSearch();
              setIsSearching(false); // 搜索完成
            }, 300);
          } else {
            // 如果没有 chatMessagesRef，直接执行搜索
            setTimeout(() => {
              performSearch();
              setIsSearching(false);
            }, 300);
          }
        } else {
          resetHighlights();
          setIsSearching(false); // 搜索完成
        }
      } catch (error) {
        console.error('MiniSearch error:', error);
        resetHighlights();
        setIsSearching(false); // 出错时也要取消 loading
      }
    },
    [buildSearchIndex, performSearch, resetHighlights, chatMessagesRef],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = React.useCallback(
    debounce((value) => {
      handleSearch(value);
    }, 300), // 减少 debounce 时间从 500ms 到 300ms，提升响应速度
    [handleSearch],
  );

  React.useEffect(() => {
    debouncedSearch(searchKeyword);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchKeyword, debouncedSearch]);

  const navigate = React.useCallback(
    (direction: number) => {
      if (searchMessageResult.length === 0) {
        setCurrentIndex(-1);
        return;
      }
      if (searchResults.length === 0) return;

      let newIndex = currentIndex + direction;
      if (newIndex < 0) newIndex = searchResults.length - 1;
      if (newIndex >= searchResults.length) newIndex = 0;

      setCurrentIndex(newIndex);
      const contentElement = chatContextRef.current;
      if (!contentElement) return;

      const currentResult = searchResults[newIndex];
      const element = document.getElementById(
        `search-highlight-${currentResult.id}`,
      );

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const highlights =
          contentElement.querySelectorAll('.search-highlight');
        highlights.forEach((el) => el.classList.remove('current-highlight'));
        element.classList.add('current-highlight');
      }
    },
    [searchResults, currentIndex, chatContextRef, searchMessageResult],
  );

  const resetSearch = React.useCallback(() => {
    setSearchKeyword('');
    setSearchResults([]);
    setCurrentIndex(-1);
    resetHighlights();
    setShowSearch(false);
  }, [resetHighlights]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.code === 'KeyF') {
          if (disabled) {
            e.preventDefault();
            return;
          }
          setShowSearch(true);
          e.preventDefault();
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        }
      }
      if (e.code === 'Escape') {
        resetSearch();
      }
      if (e.code === 'Enter') {
        if (isFocused) {
          navigate(1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, resetSearch, isFocused, disabled]);

  const shortcutKeyTooltip = React.useMemo(() => {
    const shortcutKey = isMac ? 'Command' : 'Ctrl';
    return `搜索会话(${shortcutKey} + F)`;
  }, [isMac]);

  return (
    <Box display="flex" alignItems="center">
      {/* 搜索按钮 - 未展开时显示 */}
      {!showSearch && (
        <Tooltip label={shortcutKeyTooltip}>
          <IconButton
            size="xs"
            aria-label="搜索"
            icon={<Icon as={IoSearchSharp} size="sm" />}
            color="text.default"
            onClick={() => {
              if (disabled) return;
              setShowSearch(true);
              setTimeout(() => {
                inputRef.current?.focus();
              }, 0);
            }}
            isDisabled={disabled}
            bg="none"
          />
        </Tooltip>
      )}

      {/* 搜索输入框 - 展开时显示，与 icon 在同一行 */}
      {showSearch && (
        <Box
          display="flex"
          alignItems="center"
          color="text.secondary"
          background="listBgColor"
          borderRadius="8px"
          h="22px"
          px="1"
        >
          <Input
            maxW="100px"
            h="22px"
            placeholder="输入搜索..."
            value={searchKeyword}
            ref={inputRef}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setSearchKeyword(value);
              // 输入时立即显示 loading（如果长度>=2）
              if (value.trim().length >= 2) {
                setIsSearching(true);
              } else {
                setIsSearching(false);
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          <Box fontSize="12px" color="text.default" mx="1" textAlign="center" whiteSpace="nowrap">
            {isSearching
              ? '搜索中...'
              : searchKeyword.trim().length > 0 && searchKeyword.trim().length < 2
              ? '至少2字符'
              : searchResults.length > 0
              ? `${currentIndex + 1}/${searchResults.length}`
              : searchKeyword.trim().length >= 2
              ? '0/0'
              : ''}
          </Box>
          <IconButton
            size="xs"
            aria-label="上一个"
            icon={<Icon as={IoChevronUp} size="xs" />}
            color="text.default"
            onClick={() => navigate(1)}
            bg="none"
          />
          <IconButton
            size="xs"
            aria-label="下一个"
            icon={<Icon as={IoChevronDownSharp} size="xs" />}
            color="text.default"
            onClick={() => navigate(-1)}
            bg="none"
          />
          <IconButton
            size="xs"
            aria-label="关闭"
            icon={<Icon as={IoClose} size="sm" />}
            color="text.default"
            onClick={() => {
              resetSearch();
            }}
            bg="none"
          />
        </Box>
      )}
    </Box>
  );
};

export default ChatSearch;