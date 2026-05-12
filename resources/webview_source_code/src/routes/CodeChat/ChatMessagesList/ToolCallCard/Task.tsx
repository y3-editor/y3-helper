/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * SubagentTaskCard —— 子代理任务状态卡片（三段式 Accordion）
 *
 * 布局：
 * 1. Target Task：agent 名称 + 任务描述
 * 2. Execution Details：tool call blocks（活跃实时 / 历史懒加载）
 * 3. Execution Result：最终结果 Markdown
 *
 * 底部统计栏：工具调用次数 + 总耗时（完成后计算）
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import { TbTarget, TbFileCheck, TbLayoutList, TbSubtask } from 'react-icons/tb';

import { ChatMessage, ToolCall } from '../../../../services';
import { ChatSession, useChatStore } from '../../../../store/chat';
import {
  useSubagentStore,
  runnerManager,
  retrySubagent,
  stopFailedSubagent,
  useToolConfirmationStore,
} from '../../../../modules/subagent';
import SubagentToolConfirmationPanel from '../../../../modules/subagent/components/SubagentToolConfirmationPanel';
import { getStringContent, truncateContent } from '../../../../utils';
import { useTheme, ThemeStyle } from '../../../../ThemeContext';
import MemoCodeBlock from '../../../../components/Markdown/CodeBlock';
import TaskDetailModal from './TaskDetailModal';
import styles from './Task.module.scss';
import { formatTokenCount } from '../../../../utils/consumedTokensCalculator';
import { ChatRole } from '../../../../types/chat';
import { useChatConfig } from '../../../../store/chat-config';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}m ${remainSeconds}s`;
}

/** Token 使用详情类型 */
interface TokenUsageDetail {
  // Claude 模型特有字段
  cacheCreation: number;
  readCache: number;
  // 通用字段
  prompt: number;
  // 总计
  total: number;
  // 是否有缓存数据（用于判断显示哪种布局）
  hasCache: boolean;
}

/** Token 行组件 */
interface TokenRowProps {
  color: string;
  label: string;
  value: number;
  total: number;
  isDark: boolean;
}

function TokenRow({ color, label, value, total, isDark }: TokenRowProps) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <Flex alignItems="center" gap={2} py={0.5} justifyContent="space-between">
      <Flex alignItems="center" gap={2} flex={1} minW={0}>
        <Box w="8px" h="8px" borderRadius="2px" flexShrink={0} bg={color} />
        <Text fontSize="xs" fontFamily="monospace" whiteSpace="nowrap">
          {label}
        </Text>
      </Flex>
      <Flex
        fontSize="xs"
        fontFamily="mono"
        whiteSpace="nowrap"
        alignItems="center"
        gap={1}
        flexShrink={0}
      >
        <Text fontWeight="semibold" color={isDark ? '#E0E0E0' : '#111'}>
          {formatTokenCount(value)}
        </Text>
        <Text w="44px" textAlign="right" color={isDark ? '#888' : '#999'}>
          ({pct}%)
        </Text>
      </Flex>
    </Flex>
  );
}

/** Token 详情 Popover 组件 */
interface TokenUsagePopoverProps {
  tokenUsage: TokenUsageDetail | null;
  isDark: boolean;
}

function TokenUsagePopover({ tokenUsage, isDark }: TokenUsagePopoverProps) {
  if (!tokenUsage) {
    return (
      <HStack spacing={1}>
        <Text fontSize="xs" color="text.secondary">
          Tokens:
        </Text>
        <Text fontSize="xs" color="text.primary" fontWeight="medium">
          —
        </Text>
      </HStack>
    );
  }

  // 根据是否有缓存数据决定显示的行
  const tokenRows = tokenUsage.hasCache
    ? [
        {
          color: '#60a5fa',
          label: 'Cache Creation',
          value: tokenUsage.cacheCreation,
        },
        { color: '#34d399', label: 'Prompt Tokens', value: tokenUsage.prompt },
        { color: '#a78bfa', label: 'Read Cache', value: tokenUsage.readCache },
      ]
    : [{ color: '#34d399', label: 'Prompt Tokens', value: tokenUsage.prompt }];

  return (
    <Popover placement="top" trigger="hover" openDelay={0} closeDelay={200}>
      <PopoverTrigger>
        <HStack
          spacing={1}
          cursor="pointer"
          _hover={{ opacity: 0.8 }}
          transition="all 0.2s"
        >
          <Text fontSize="xs" color="text.secondary">
            Tokens:
          </Text>
          <Text
            fontSize="xs"
            color="text.primary"
            fontWeight="medium"
            _hover={{ color: '#776fff' }}
          >
            {formatTokenCount(tokenUsage.total)}
          </Text>
        </HStack>
      </PopoverTrigger>
      <PopoverContent
        bg={isDark ? '#1E1E1E' : '#FFFFFF'}
        border="1px solid"
        borderColor={isDark ? '#333333' : '#E5E7EB'}
        boxShadow="xl"
        _focus={{ boxShadow: 'xl' }}
        borderRadius="lg"
        width="auto"
        minW="220px"
      >
        <PopoverBody px={3} py={2}>
          <Flex direction="column" gap={0.5}>
            <Text
              fontSize="xs"
              color={isDark ? '#AAAAAA' : '#555'}
              mb={1.5}
              fontWeight="medium"
            >
              Subagent Tokens 分布：
            </Text>
            {tokenRows.map((row) => (
              <TokenRow
                key={row.label}
                color={row.color}
                label={row.label}
                value={row.value}
                total={tokenUsage.total}
                isDark={isDark}
              />
            ))}
          </Flex>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 解析后端时间字符串为毫秒时间戳。
 * 格式示例：2026-03-04T11:48:54.254000（含微秒精度）
 * JS Date 仅支持毫秒精度，需截断到 3 位小数。
 */
function parseTimestamp(timeStr: string): number {
  if (!timeStr) return 0;
  // 将 .NNNNNN 截断为 .NNN（毫秒精度），兼容标准 Date 解析
  const normalized = timeStr.replace(/\.(\d{3})\d*/, '.$1');
  const ts = new Date(normalized).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/** 从 session metadata 计算耗时（毫秒） */
function calcDurationFromMetadata(metadata?: {
  create_time: string;
  update_time: string;
}): number {
  if (!metadata) return 0;
  const start = parseTimestamp(metadata.create_time);
  const end = parseTimestamp(metadata.update_time);
  return start > 0 && end > start ? end - start : 0;
}

interface ToolCallBlock {
  id: string;
  name: string;
  arguments: string;
}

function extractToolCallsFromMessages(
  messages: ChatMessage[],
): ToolCallBlock[] {
  const blocks: ToolCallBlock[] = [];
  for (const msg of messages) {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        blocks.push({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments || '',
        });
      }
    }
  }
  return blocks;
}

interface ToolCallBlockItemProps {
  block: ToolCallBlock;
}

const ToolCallBlockItem = React.memo(function ToolCallBlockItem({
  block,
}: ToolCallBlockItemProps) {
  const formattedArgs = useMemo(() => {
    if (!block.arguments) return '';
    try {
      return JSON.stringify(JSON.parse(block.arguments), null, 2);
    } catch {
      return block.arguments;
    }
  }, [block.arguments]);

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      borderColor="border.default"
      overflow="hidden"
      fontSize="xs"
      bg="bg.surface"
    >
      <HStack
        px={2}
        py={1}
        bg="bg.muted"
        borderBottomWidth={formattedArgs ? '1px' : 0}
        borderColor="border.default"
      >
        <Badge colorScheme="green" fontSize="2xs" flexShrink={0}>
          tool_call
        </Badge>
        <Text fontWeight="medium" color="text.primary" isTruncated>
          {block.name}
        </Text>
      </HStack>
      {formattedArgs && (
        <Box px={2} py={1} maxH="160px" overflowY="auto">
          <Text
            as="pre"
            fontSize="2xs"
            fontFamily="mono"
            color="text.secondary"
            whiteSpace="pre-wrap"
            wordBreak="break-all"
          >
            {formattedArgs}
          </Text>
        </Box>
      )}
    </Box>
  );
});

interface ActiveExecutionDetailsProps {
  taskId: string;
}

const ActiveExecutionDetails = React.memo(function ActiveExecutionDetails({
  taskId,
}: ActiveExecutionDetailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const session = useSubagentStore((s) => s.getSubagentSession(taskId));

  const blocks = React.useMemo(() => {
    if (!session || !session.messages) return [];
    const result: ToolCallBlock[] = [];
    for (const msg of session.messages) {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          result.push({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments || '',
          });
        }
      }
    }
    return result;
  }, [session]);

  useEffect(() => {
    if (containerRef.current && blocks.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [blocks.length]);

  if (blocks.length === 0) {
    return (
      <HStack spacing={2} py={2}>
        <Spinner size="xs" color="blue.400" />
        <Text fontSize="xs" color="text.secondary">
          Waiting for tool calls...
        </Text>
      </HStack>
    );
  }

  return (
    <VStack ref={containerRef} align="stretch" spacing={2}>
      {blocks.map((block, index) => (
        <ToolCallBlockItem key={`${block.id}-${index}`} block={block} />
      ))}
    </VStack>
  );
});

interface HistoryExecutionDetailsProps {
  blocks: ToolCallBlock[];
  loading: boolean;
  error: string;
}

const HistoryExecutionDetails = React.memo(function HistoryExecutionDetails({
  blocks,
  loading,
  error,
}: HistoryExecutionDetailsProps) {
  if (loading) {
    return (
      <HStack spacing={2} py={2}>
        <Spinner size="xs" />
        <Text fontSize="xs" color="text.secondary">
          Loading…
        </Text>
      </HStack>
    );
  }

  if (error) {
    return (
      <VStack align="stretch" spacing={1}>
        <Text fontSize="xs" color="red.400">
          {error}
        </Text>
      </VStack>
    );
  }

  if (blocks.length === 0) {
    return (
      <Text fontSize="xs" color="text.secondary" py={1}>
        No tool calls recorded.
      </Text>
    );
  }

  return (
    <VStack align="stretch" spacing={2}>
      {blocks.map((block, index) => (
        <ToolCallBlockItem key={`${block.id}-${index}`} block={block} />
      ))}
    </VStack>
  );
});

interface SessionLoadState {
  session: ChatSession | null;
  blocks: ToolCallBlock[];
  loading: boolean;
  error: string;
  retry: () => void;
}

function useSessionData(taskId: string, enabled: boolean): SessionLoadState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = React.useRef(false);

  const subagentSession = useSubagentStore((s) => s.getSubagentSession(taskId));

  const session = React.useMemo(() => {
    if (!subagentSession) return null;
    return {
      _id: subagentSession._id,
      data: {
        messages: subagentSession.messages,
        model: subagentSession.model,
        consumedTokens: subagentSession.consumedTokens,
      },
      metadata: subagentSession.metadata,
    } as ChatSession;
  }, [subagentSession]);

  const blocks = React.useMemo(() => {
    if (!session?.data?.messages) return [];
    return extractToolCallsFromMessages(session.data.messages);
  }, [session?.data?.messages]);

  const load = useCallback(async () => {
    if (!taskId || loadedRef.current) return;

    loadedRef.current = true;
    setLoading(true);
    setError('');

    try {
      await useSubagentStore.getState().loadSubagentSession(taskId);
    } catch (err) {
      loadedRef.current = false;
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const retry = useCallback(() => {
    loadedRef.current = false;
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !taskId) return;
    const needsLoad = !subagentSession || subagentSession.messages.length === 0;
    if (needsLoad && !loadedRef.current) {
      load();
    }
  }, [enabled, taskId, subagentSession, load]);

  return { session, blocks, loading, error, retry };
}

interface SubagentTaskCardProps {
  tool: ToolCall;
  toolParams: Record<string, any>;
  result: any;
  toolResponseDisabled?: boolean;
}

function SubagentTaskCard({ tool, toolParams, result }: SubagentTaskCardProps) {
  const { activeTheme } = useTheme();
  const isDark = activeTheme === ThemeStyle.Dark;

  const statusInfo = useSubagentStore((s) => s.statuses[tool.id]);
  const queuedInfo = useSubagentStore((s) => s.queuedStatuses[tool.id]);
  const currentSession = useChatStore((s) => s.currentSession());
  const chatModels = useChatConfig((state) => state.chatModels);
  const [expandedIndex, setExpandedIndex] = useState<number[]>([]);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const taskIdFromContent = useMemo(() => {
    const content = typeof result.content === 'string' ? result.content : '';
    const newFormatMatch = content.match(/<task_id>\s*([^<]+?)\s*<\/task_id>/);
    if (newFormatMatch) return newFormatMatch[1].trim();

    const oldFormatMatch = content.match(/^task_id:\s*(\S+)/);
    return oldFormatMatch?.[1] || '';
  }, [result.content]);

  // ✅ 优先从多个来源获取 taskId，确保持久化后仍能访问
  const taskId = useMemo(() => {
    // 1. 从 statusInfo 获取（活跃任务）
    if (statusInfo?.taskId) return statusInfo.taskId;

    // 2. 从 content 解析（标准流程）
    if (taskIdFromContent) return taskIdFromContent;

    // 3. 兜底：从 tool message 的 context 获取（页面刷新后恢复）
    if (currentSession?.data?.messages) {
      const toolMsg = currentSession.data.messages.find(
        (msg) =>
          msg.role === ChatRole.Tool &&
          msg.tool_call_id === tool.id &&
          msg.context?.task?.taskId,
      );
      if (toolMsg?.context?.task?.taskId) {
        return toolMsg.context.task.taskId;
      }
    }

    return '';
  }, [
    statusInfo?.taskId,
    taskIdFromContent,
    currentSession?.data?.messages,
    tool.id,
  ]);

  const subagentSession = useSubagentStore((s) => s.getSubagentSession(taskId));

  const pendingConfirmation = useToolConfirmationStore((s) => {
    if (!s.pendingConfirmation) return null;
    return s.pendingConfirmation.taskId === taskId
      ? s.pendingConfirmation
      : null;
  });

  const handleConfirm = useCallback(() => {
    useToolConfirmationStore.getState().confirm();
  }, []);

  const handleReject = useCallback(() => {
    useToolConfirmationStore.getState().reject();
  }, []);

  const isQueued = !!queuedInfo;

  // 首先判断 aborted 状态（需要在其他状态判断之前）
  const isAborted = useMemo(() => {
    // 1. 从 statusInfo 判断
    if (statusInfo?.status === 'aborted') return true;

    // 2. 从 result.content 精确解析状态
    const content = typeof result.content === 'string' ? result.content : '';

    // 精确匹配 <task_status>aborted</task_status>（允许中间有空白字符）
    const statusMatch = content.match(
      /<task_status>\s*aborted\s*<\/task_status>/i,
    );
    if (statusMatch) {
      return true;
    }

    // 检查是否包含 task_rejection 标签（表示用户中止）
    if (content.includes('<task_rejection>')) {
      return true;
    }

    return false;
  }, [statusInfo?.status, result.content]);

  // 从多个来源判断失败状态（statusInfo 可能在 5 秒后被延迟清理）
  // 注意：aborted 状态不应该被认为是 failed
  const isFailed = useMemo(() => {
    // 0. 如果是 aborted，不算 failed
    if (isAborted) return false;

    // 1. 优先从 statusInfo 获取（5 秒内可用）
    if (statusInfo?.status === 'failed') return true;

    // 2. 从 subagentSession 获取（持久化存储）
    if (subagentSession?.status === 'failed' || subagentSession?.error)
      return true;

    // 3. 从 result.isError 判断
    if (result.isError) return true;

    // 4. 备用：从 task 工具返回的内容中精确解析状态
    const content = typeof result.content === 'string' ? result.content : '';
    const statusMatch = content.match(
      /<task_status>\s*failed\s*<\/task_status>/i,
    );
    return !!statusMatch;
  }, [
    isAborted,
    statusInfo?.status,
    subagentSession?.status,
    subagentSession?.error,
    result.isError,
    result.content,
  ]);

  // 判断是否处于活跃状态（运行中）
  // 注意：必须排除 failed 和 aborted 状态，确保与失败/中止状态互斥
  const isActive =
    !isFailed &&
    !isAborted &&
    statusInfo &&
    (statusInfo.status === 'pending' ||
      statusInfo.status === 'running' ||
      statusInfo.status === 'waiting_tool');

  const sessionState = useSessionData(taskId, !!taskId && !isActive);

  const handleStop = useCallback(() => {
    if (!taskId) return;
    const runner = runnerManager.get(taskId);
    if (runner) {
      runner.abortController.abort();
    }
  }, [taskId]);

  const handleRetry = useCallback(() => {
    retrySubagent(tool.id);
  }, [tool.id]);

  const handleStopFailed = useCallback(() => {
    stopFailedSubagent(tool.id);
  }, [tool.id]);

  // 从结果中提取 task_result 内容
  const taskResultText = useMemo(() => {
    const content = typeof result.content === 'string' ? result.content : '';
    const match = content.match(/<task_result>\n?([\s\S]*?)\n?<\/task_result>/);
    return match?.[1]?.trim() || '';
  }, [result.content]);

  const renderAgentName = useMemo(() => {
    const name =
      statusInfo?.agentName || toolParams.subagent_type || 'subagent';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [statusInfo?.agentName, toolParams.subagent_type]);

  const description = statusInfo?.description || toolParams.description || '';
  const prompt = toolParams.prompt || '';
  const targetTaskContent = useMemo(
    () => prompt || description || '',
    [description, prompt],
  );

  // 从多个来源获取错误信息（statusInfo 可能在 5 秒后被延迟清理）
  const errorMessage = useMemo(() => {
    // 1. 优先从 statusInfo 获取（5 秒内可用）
    if (statusInfo?.errorMessage) return statusInfo.errorMessage;
    // 2. 从 subagentSession.error 获取（持久化存储）
    if (subagentSession?.error) return subagentSession.error;
    // 3. 从 task_result 中解析 "Error: xxx" 格式的错误信息
    if (taskResultText.startsWith('Error:')) {
      return taskResultText.slice(7).trim(); // 移除 "Error: " 前缀
    }
    // 4. 如果 result.isError 但没有 task_result，使用原始内容
    if (result.isError) {
      const content = getStringContent(result.content);
      // 尝试从 XML 格式中提取错误信息
      const taskResultMatch = content.match(
        /<task_result>\n?([\s\S]*?)\n?<\/task_result>/,
      );
      if (taskResultMatch) {
        const extracted = taskResultMatch[1].trim();
        return extracted.startsWith('Error:')
          ? extracted.slice(7).trim()
          : extracted;
      }
      return content;
    }
    return '';
  }, [
    statusInfo?.errorMessage,
    subagentSession?.error,
    result.isError,
    result.content,
    taskResultText,
  ]);

  const toolCallCount = isActive
    ? (statusInfo?.toolCalls || []).length
    : sessionState.blocks.length;

  const elapsed = useMemo(() => {
    // 活跃状态不显示耗时
    if (isActive) return 0;
    // 优先使用 statusInfo 中的时间信息（完成后 5 秒内仍可用）
    if (statusInfo?.startTime && statusInfo?.endTime) {
      return statusInfo.endTime - statusInfo.startTime;
    }
    // 历史会话：从 metadata 计算
    return calcDurationFromMetadata(subagentSession?.metadata);
  }, [
    isActive,
    statusInfo?.startTime,
    statusInfo?.endTime,
    subagentSession?.metadata,
  ]);

  const tokenUsage = useMemo((): TokenUsageDetail | null => {
    const tokens = subagentSession?.consumedTokens;
    if (!tokens) return null;

    // 判断是否有缓存相关数据（Claude 模型特有）
    const cacheCreation = tokens.cacheCreationInputTokens || 0;
    const readCache = tokens.readCacheTokens || 0;
    const hasCache = cacheCreation > 0 || readCache > 0;

    const prompt = tokens.promptTokens || 0;

    // 根据是否有缓存数据计算总量
    // Claude 模型：cacheCreation + prompt + readCache
    // 非 Claude 模型：只使用 prompt
    const total = hasCache ? cacheCreation + prompt + readCache : prompt;

    return total > 0
      ? { cacheCreation, prompt, readCache, total, hasCache }
      : null;
  }, [subagentSession]);

  const modelName = useMemo(() => {
    const model = statusInfo?.model || subagentSession?.model || '';
    if (!chatModels || Object.keys(chatModels).length === 0) {
      return model || 'Unknown Model';
    }
    for (const key in chatModels) {
      if (!Object.hasOwn(chatModels, key)) continue;
      const modelInfo = chatModels[key];
      if (!modelInfo.useModel) continue;
      if (modelInfo.useModel === model) {
        return modelInfo.title;
      }
    }
    return 'Unknown Model';
  }, [statusInfo?.model, subagentSession?.model, chatModels]);

  const handleAccordionChange = useCallback((index: number[]) => {
    setExpandedIndex(index);
  }, []);

  // 当执行结果有错误时，自动展开「执行结果」Accordion
  const hasError = isFailed || result.isError || isAborted;
  useEffect(() => {
    if (hasError && !hasAutoExpanded && !isActive) {
      // 索引 2 对应「执行结果」（第三个 AccordionItem）
      setExpandedIndex((prev) => (prev.includes(2) ? prev : [...prev, 2]));
      setHasAutoExpanded(true);
    }
  }, [hasError, hasAutoExpanded, isActive]);

  if (pendingConfirmation) {
    return (
      <SubagentToolConfirmationPanel
        toolName={pendingConfirmation.toolName}
        toolParams={pendingConfirmation.toolParams}
        isDangerous={pendingConfirmation.isDangerous}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    );
  }

  return (
    <Box className={styles.taskCard} position="relative">
      <HStack
        px={3}
        py={2}
        justify="space-between"
        bg="bg.muted"
        borderBottomWidth="1px"
      >
        <HStack spacing={2} flex={1} minW={0}>
          {isActive && <Spinner size="xs" color="blue.400" />}
          {isQueued && (
            <Icon
              as={() => (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.3" />
                  <path d="M12 6v6l4 2" />
                </svg>
              )}
              color="yellow.500"
            />
          )}
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color="text.primary"
            isTruncated
          >
            {renderAgentName} ({queuedInfo?.description || description})
          </Text>
          {isActive && (
            <Badge colorScheme="blue" fontSize="2xs" variant="subtle">
              Running
            </Badge>
          )}
          {isFailed && (
            <Badge colorScheme="red" fontSize="2xs" variant="subtle">
              Failed
            </Badge>
          )}
        </HStack>
        <HStack spacing={2} flexShrink={0}>
          {!!taskId && !isQueued && (
            <Tooltip label="查看详情" fontSize="xs" placement="top" hasArrow>
              <Button
                size="xs"
                variant="ghost"
                colorScheme="blue"
                onClick={onOpen}
                aria-label="查看详情"
              >
                <Icon as={TbLayoutList} boxSize={3.5} />
              </Button>
            </Tooltip>
          )}
          {isQueued && (
            <Badge
              colorScheme="yellow"
              fontSize="2xs"
              variant="subtle"
              cursor="default"
            >
              Pending
            </Badge>
          )}
          {isActive && (
            <Button
              size="xs"
              colorScheme="red"
              variant="ghost"
              onClick={handleStop}
            >
              Stop
            </Button>
          )}
          {isFailed && (
            <>
              <Button
                size="xs"
                colorScheme="red"
                variant="ghost"
                onClick={handleStopFailed}
              >
                Stop
              </Button>
              <Button
                size="xs"
                colorScheme="blue"
                variant="solid"
                onClick={handleRetry}
              >
                Retry
              </Button>
            </>
          )}
        </HStack>
      </HStack>

      {/* 三段式 Accordion */}
      <Accordion
        allowMultiple
        index={expandedIndex}
        onChange={handleAccordionChange}
        display="flex"
        flexDirection="column"
        gap={0}
        m={2}
      >
        {/* 1. Target Task */}
        <AccordionItem
          borderTop="none"
          borderBottom=".5px"
          borderColor="#3a3a3a"
        >
          <AccordionButton py={2} px={3} _hover={{ bg: 'bg.subtle' }}>
            <HStack flex="1" spacing={2}>
              <Icon as={TbTarget} color="blue.400" boxSize={4} />
              <Text
                textAlign="left"
                fontSize="sm"
                fontWeight="medium"
                color="text.primary"
              >
                目标任务
              </Text>
            </HStack>
            <AccordionIcon color="text.secondary" />
          </AccordionButton>
          <AccordionPanel
            px={3}
            py={2}
            maxH="240px"
            overflowY="auto"
            bg="bg.subtle"
          >
            {targetTaskContent ? (
              <pre>
                <MemoCodeBlock
                  maxHeight={240}
                  language="plaintext"
                  hiddenLineNumber
                  value={truncateContent(targetTaskContent)}
                />
              </pre>
            ) : (
              <Text fontSize="xs" color="text.secondary">
                No description
              </Text>
            )}
          </AccordionPanel>
        </AccordionItem>

        {/* 2. Execution Details — tool call blocks */}
        <AccordionItem borderBottom=".5px" borderColor="#3a3a3a">
          <AccordionButton py={2} px={3} _hover={{ bg: 'bg.subtle' }}>
            <HStack flex="1" spacing={2}>
              <Icon as={TbSubtask} color="orange.400" boxSize={4} />
              <Text
                textAlign="left"
                fontSize="sm"
                fontWeight="medium"
                color="text.primary"
              >
                执行详情
              </Text>
              {isActive && toolCallCount > 0 && (
                <Badge colorScheme="orange" fontSize="2xs" variant="subtle">
                  {toolCallCount}
                </Badge>
              )}
            </HStack>
            <AccordionIcon color="text.secondary" />
          </AccordionButton>
          <AccordionPanel
            px={3}
            py={2}
            maxH="320px"
            overflowY="auto"
            bg="bg.subtle"
          >
            {taskId ? (
              isActive ? (
                <ActiveExecutionDetails taskId={taskId} />
              ) : (
                <HistoryExecutionDetails
                  blocks={sessionState.blocks}
                  loading={sessionState.loading}
                  error={sessionState.error}
                />
              )
            ) : (
              <HStack spacing={2} py={2}>
                <Spinner size="xs" />
                <Text fontSize="xs" color="text.secondary">
                  Waiting for task to start…
                </Text>
              </HStack>
            )}
          </AccordionPanel>
        </AccordionItem>

        {/* 3. Execution Result */}
        <AccordionItem borderBottom="none">
          <AccordionButton py={2} px={3} _hover={{ bg: 'bg.subtle' }}>
            <HStack flex="1" spacing={2}>
              <Icon
                as={TbFileCheck}
                color={
                  isAborted || isFailed || result.isError
                    ? 'red.400'
                    : 'green.400'
                }
                boxSize={4}
              />
              <Text
                textAlign="left"
                fontSize="sm"
                fontWeight="medium"
                color="text.primary"
              >
                执行结果
              </Text>
              {!isActive && !isAborted && !result.isError && taskResultText && (
                <Badge colorScheme="green" fontSize="2xs" variant="subtle">
                  Done
                </Badge>
              )}
              {isAborted && (
                <Badge colorScheme="red" fontSize="2xs" variant="subtle">
                  Aborted
                </Badge>
              )}
              {!isActive && result.isError && (
                <Badge colorScheme="red" fontSize="2xs" variant="subtle">
                  Error
                </Badge>
              )}
            </HStack>
            <AccordionIcon color="text.secondary" />
          </AccordionButton>
          <AccordionPanel
            px={3}
            py={2}
            maxH="320px"
            overflowY="auto"
            bg="bg.subtle"
          >
            {isAborted ? (
              <Text fontSize="xs" color="red.400">
                [Request interrupted by user for tool use]
              </Text>
            ) : isFailed ? (
              <Box>
                <Text fontSize="xs" color="red.400" fontWeight="medium" mb={1}>
                  执行失败
                </Text>
                {errorMessage ? (
                  <Text fontSize="xs" color="red.300" whiteSpace="pre-wrap">
                    {errorMessage}
                  </Text>
                ) : taskResultText ? (
                  <Text fontSize="xs" color="red.300" whiteSpace="pre-wrap">
                    {taskResultText}
                  </Text>
                ) : (
                  <Text fontSize="xs" color="red.300">
                    未知错误
                  </Text>
                )}
              </Box>
            ) : taskResultText ? (
              <pre>
                <MemoCodeBlock
                  maxHeight={280}
                  language="plaintext"
                  hiddenLineNumber
                  value={truncateContent(taskResultText)}
                />
              </pre>
            ) : (
              <HStack spacing={2} py={1}>
                {isActive && <Spinner size="xs" color="blue.400" />}
                <Text fontSize="xs" color="text.secondary">
                  {isActive ? 'Running…' : 'No result'}
                </Text>
              </HStack>
            )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      {/* 底部统计栏 */}
      <HStack
        px={3}
        py={1.5}
        borderTopWidth="1px"
        borderColor="border.default"
        spacing={4}
        bg="bg.muted"
        wrap="wrap"
      >
        <HStack spacing={1}>
          <Text fontSize="xs" color="text.secondary">
            Model:
          </Text>
          <Text fontSize="xs" color="text.primary" fontWeight="medium">
            {modelName || '—'}
          </Text>
        </HStack>
        <HStack spacing={1}>
          <Text fontSize="xs" color="text.secondary">
            Tool Calls:
          </Text>
          <Text fontSize="xs" color="text.primary" fontWeight="medium">
            {toolCallCount}
          </Text>
        </HStack>
        <TokenUsagePopover tokenUsage={tokenUsage} isDark={isDark} />
        <HStack spacing={1}>
          <Text fontSize="xs" color="text.secondary">
            耗时:
          </Text>
          <Text fontSize="xs" color="text.primary" fontWeight="medium">
            {elapsed > 0 ? formatDuration(elapsed) : '—'}
          </Text>
        </HStack>
      </HStack>

      <TaskDetailModal
        isOpen={isOpen}
        onClose={onClose}
        taskId={taskId}
        isActive={!!isActive}
        agentName={renderAgentName}
        description={description}
        loading={sessionState.loading}
        error={sessionState.error}
      />
    </Box>
  );
}

export default SubagentTaskCard;