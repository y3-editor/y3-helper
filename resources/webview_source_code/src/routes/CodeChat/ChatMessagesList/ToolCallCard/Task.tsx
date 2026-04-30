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
  HStack,
  Icon,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import { TbTarget, TbSubtask, TbFileCheck, TbLayoutList } from 'react-icons/tb';

import { ChatMessage, ToolCall } from '../../../../services';
import { ChatSession } from '../../../../store/chat';
import {
  useSubagentStore,
  useSubagentEventStore,
  runnerManager,
  retrySubagent,
  stopFailedSubagent,
} from '../../../../modules/subagent';
import { getSessionData } from '../../../../services/chat';
import {
  formatTokenCount,
  getStringContent,
  truncateContent,
} from '../../../../utils';
import MemoCodeBlock from '../../../../components/Markdown/CodeBlock';
import TaskDetailModal from './TaskDetailModal';
import styles from './Task.module.scss';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}m ${remainSeconds}s`;
}

/**
 * 格式化模型名称以便在 UI 中友好显示
 * @param modelName 原始模型名称
 * @returns 格式化后的模型名称
 */
function formatModelName(modelName: string): string {
  if (!modelName) return '';

  // 将常见的模型名称格式化
  const formatMap: Record<string, string> = {
    // Claude 4.5 系列
    'claude-sonnet-4-5-20250929': 'Claude 4.5 Sonnet',
    'claude-opus-4-5-20251101': 'Claude 4.5 Opus',
    'claude-haiku-4-5-20251001': 'Claude 4.5 Haiku',
    // Claude 4.0 系列
    'claude-sonnet-4-20250514': 'Claude 4 Sonnet',
    'claude-opus-4-20250514': 'Claude 4 Opus',
    'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
    // 其他模型
    'gpt-4o': 'GPT-4o',
    'gpt-4': 'GPT-4',
    'deepseek-chat': 'DeepSeek Chat',
    'deepseek-reasoner': 'DeepSeek Reasoner',
    'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
    'qwen-max-2025-01-25': 'Qwen Max',
  };

  // 如果有精确匹配，返回友好名称
  if (formatMap[modelName]) {
    return formatMap[modelName];
  }

  // 否则进行简单的启发式格式化
  return modelName
    .replace(/^claude-/, 'Claude ')
    .replace(/^gpt-/, 'GPT ')
    .replace(/^deepseek-/, 'DeepSeek ')
    .replace(/^gemini-/, 'Gemini ')
    .replace(/^qwen/, 'Qwen')
    .replace(/-20\d{6}.*$/, '') // 移除日期后缀
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()); // 首字母大写
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

// ============================================================
// Tool Call 数据提取
// ============================================================

/** 统一的 tool call 展示数据 */
interface ToolCallBlock {
  id: string;
  name: string;
  arguments: string;
}

/** 从 session messages 中提取 tool call blocks */
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

// ============================================================
// 单个 ToolCall Block 组件
// ============================================================

interface ToolCallBlockItemProps {
  block: ToolCallBlock;
}

const ToolCallBlockItem = React.memo(function ToolCallBlockItem({
  block,
}: ToolCallBlockItemProps) {
  /** 尝试格式化 JSON arguments，失败则原样返回 */
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

// ============================================================
// 执行详情：活跃 subagent（实时）带自动滚动
// ============================================================

interface ActiveExecutionDetailsProps {
  taskId: string;
}

const ActiveExecutionDetails = React.memo(function ActiveExecutionDetails({
  taskId,
}: ActiveExecutionDetailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 订阅事件 store，每次事件变化都重新过滤
  const blocks = useSubagentEventStore((s) => {
    const result: ToolCallBlock[] = [];
    for (const event of s.events) {
      if (event.taskId !== taskId || event.type !== 'tool_call') continue;
      result.push({
        id: event.payload?.toolId || `event-${event.timestamp}`,
        name: event.payload?.toolName || 'unknown',
        arguments: event.payload?.arguments || '',
      });
    }
    return result;
  });

  // 当有新的 tool call 时，自动滚动到底部
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

// ============================================================
// 执行详情：历史 subagent（由父组件传入已加载的 blocks）
// ============================================================

interface HistoryExecutionDetailsProps {
  blocks: ToolCallBlock[];
  loading: boolean;
  error: string;
  onRetry: () => void;
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

// ============================================================
// Session 懒加载 Hook（供 SubagentTaskCard 统一管理）
// ============================================================

interface SessionLoadState {
  session: ChatSession | null;
  blocks: ToolCallBlock[];
  loading: boolean;
  error: string;
  retry: () => void;
}

function useSessionData(taskId: string, enabled: boolean): SessionLoadState {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [blocks, setBlocks] = useState<ToolCallBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = React.useRef(false);

  const load = useCallback(async () => {
    if (!taskId || loadedRef.current) return;
    setLoading(true);
    setError('');
    try {
      const data = await getSessionData(taskId);
      setSession(data);
      setBlocks(extractToolCallsFromMessages(data?.data?.messages || []));
      loadedRef.current = true;
    } catch (err) {
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
    if (enabled) {
      load();
    }
  }, [enabled, load]);

  return { session, blocks, loading, error, retry };
}

// ============================================================
// SubagentTaskCard
// ============================================================

interface SubagentTaskCardProps {
  tool: ToolCall;
  toolParams: Record<string, any>;
  result: any;
  toolResponseDisabled?: boolean;
}

function SubagentTaskCard({ tool, toolParams, result }: SubagentTaskCardProps) {
  // 以 tool.id（即 toolCallId）为主键查找实时状态
  const statusInfo = useSubagentStore((s) => s.statuses[tool.id]);
  // 查找排队状态
  const queuedInfo = useSubagentStore((s) => s.queuedStatuses[tool.id]);
  const [expandedIndex, setExpandedIndex] = useState<number[]>([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // 从 result.content 中解析 taskId（fallback）
  const taskIdFromContent = useMemo(() => {
    const content = typeof result.content === 'string' ? result.content : '';
    const match = content.match(/^task_id:\s*(\S+)/);
    return match?.[1] || '';
  }, [result.content]);

  const taskId = statusInfo?.taskId || taskIdFromContent;

  // 判断是否在排队中
  const isQueued = !!queuedInfo;

  const isActive =
    statusInfo &&
    (statusInfo.status === 'pending' ||
      statusInfo.status === 'running' ||
      statusInfo.status === 'waiting_tool');

  // 历史任务：统一懒加载 session 数据（执行详情 + 统计栏共享）
  const sessionState = useSessionData(taskId, !!taskId && !isActive);

  const handleStop = useCallback(() => {
    if (!taskId) return;
    const runner = runnerManager.get(taskId);
    if (runner) {
      runner.abortController.abort();
    }
  }, [taskId]);

  // failed 状态判断
  const isFailed = statusInfo?.status === 'failed';

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

  // 合并 description 和 prompt 用于"目标任务"显示
  const targetTaskContent = useMemo(
    () => prompt || description || '',
    [description, prompt],
  );

  // 检测是否为用户中止
  const isAborted = useMemo(() => {
    const content = typeof result.content === 'string' ? result.content : '';
    return content.includes('[Request interrupted by user for tool use]');
  }, [result.content]);

  // 统计数据：活跃时用 store，历史时用 session 数据
  const toolCallCount = isActive
    ? (statusInfo?.toolCalls || []).length
    : sessionState.blocks.length;

  const elapsed = useMemo(() => {
    if (isActive) {
      // 活跃任务：用 store 中的时间戳
      return statusInfo?.startTime && statusInfo?.endTime
        ? statusInfo.endTime - statusInfo.startTime
        : 0;
    }
    // 历史任务：用 session metadata 计算
    return calcDurationFromMetadata(sessionState.session?.metadata);
  }, [isActive, statusInfo, sessionState.session]);

  // Token 消耗（仅历史任务从 session 数据获取）
  const tokenUsage = useMemo(() => {
    const tokens = sessionState.session?.data?.consumedTokens;
    if (!tokens) return null;
    const total = (tokens.input || 0) + (tokens.output || 0);
    return total > 0
      ? { input: tokens.input, output: tokens.output, total }
      : null;
  }, [sessionState.session]);

  // 模型信息：优先 store（实时），fallback session data（已写入 chat_histories）
  const modelName = useMemo(() => {
    return (
      statusInfo?.model ||
      (sessionState.session?.data?.model as string | undefined)
    );
  }, [statusInfo?.model, sessionState.session?.data?.model]);


  const handleAccordionChange = useCallback((index: number[]) => {
    setExpandedIndex(index);
  }, []);

  return (
    <Box className={styles.taskCard}>
      {/* 顶部状态栏 */}
      <HStack
        px={3}
        py={2}
        justify="space-between"
        bg="bg.muted"
        borderBottomWidth="1px"
        // borderColor="border.default"
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
                  onRetry={sessionState.retry}
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
                color={isAborted || result.isError ? 'red.400' : 'green.400'}
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
            ) : taskResultText ? (
              <pre>
                <MemoCodeBlock
                  maxHeight={280}
                  language="plaintext"
                  hiddenLineNumber
                  value={truncateContent(taskResultText)}
                />
              </pre>
            ) : result.isError ? (
              <Text fontSize="xs" color="red.400">
                {getStringContent(result.content)}
              </Text>
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
            {modelName ? formatModelName(modelName) : '—'}
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
        <Tooltip
          label={
            tokenUsage ? (
              <div>
                <div>Input: {tokenUsage.input.toLocaleString()}</div>
                <div>Output: {tokenUsage.output.toLocaleString()}</div>
              </div>
            ) : undefined
          }
          fontSize="xs"
          placement="top"
          isDisabled={!tokenUsage}
          hasArrow
        >
          <HStack spacing={1} cursor={tokenUsage ? 'default' : undefined}>
            <Text fontSize="xs" color="text.secondary">
              Tokens:
            </Text>
            <Text fontSize="xs" color="text.primary" fontWeight="medium">
              {tokenUsage ? formatTokenCount(tokenUsage.total) : '—'}
            </Text>
          </HStack>
        </Tooltip>
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
        session={sessionState.session}
        blocks={sessionState.blocks}
        loading={sessionState.loading}
        error={sessionState.error}
        onRetry={sessionState.retry}
      />
    </Box>
  );
}

export default SubagentTaskCard;