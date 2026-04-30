/**
 * TaskDetailModal —— Subagent 任务详情弹窗
 *
 * 两种模式：
 * - 活跃任务：实时订阅 useSubagentEventStore 的事件流
 * - 历史任务：展示 session.data.messages 完整对话时间线
 */

import * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type { SubagentEvent } from '../../../../modules/subagent';
import {
  Badge,
  Box,
  Divider,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import {
  TbTool,
  TbRobot,
  TbUser,
  TbCheck,
  TbX,
  TbBolt,
  TbCircleDot,
  TbBrain,
} from 'react-icons/tb';

import { ChatMessage, ToolCall, ToolResult } from '../../../../services';
import { ChatSession } from '../../../../store/chat';
import { useSubagentEventStore } from '../../../../modules/subagent';

// ============================================================
// Animations
// ============================================================

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ============================================================
// Props
// ============================================================

interface ToolCallBlock {
  id: string;
  name: string;
  arguments: string;
}

export interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  isActive: boolean;
  agentName: string;
  description: string;
  session: ChatSession | null;
  blocks: ToolCallBlock[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}

// ============================================================
// 工具函数
// ============================================================

function formatJsonSafe(raw: string): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function extractTextContent(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'text')
      .map((c) => (c as any).text || '')
      .join('\n');
  }
  return '';
}

// ============================================================
// 通用：时间线条目容器（左侧 accent bar）
// ============================================================

interface TimelineItemProps {
  accentColor: string;
  children: React.ReactNode;
  animate?: boolean;
}

function TimelineItem({ accentColor, children, animate }: TimelineItemProps) {
  return (
    <Box
      display="flex"
      gap={3}
      sx={animate ? { animation: `${slideIn} 0.2s ease-out` } : undefined}
    >
      {/* 左侧竖线 + 圆点 */}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        flexShrink={0}
        pt={1}
      >
        <Box
          w="8px"
          h="8px"
          borderRadius="full"
          bg={accentColor}
          flexShrink={0}
          boxShadow={`0 0 6px ${accentColor}80`}
        />
        <Box w="1px" flex={1} bg="whiteAlpha.100" mt={1} minH="16px" />
      </Box>
      {/* 内容 */}
      <Box flex={1} minW={0} pb={2}>
        {children}
      </Box>
    </Box>
  );
}

// ============================================================
// 通用：代码/内容区块
// ============================================================

interface ContentBlockProps {
  children: React.ReactNode;
  maxH?: string;
  bg?: string;
}

function ContentBlock({
  children,
  maxH = '200px',
  bg = 'whiteAlpha.50',
}: ContentBlockProps) {
  return (
    <Box
      mt={1.5}
      px={3}
      py={2}
      bg={bg}
      borderRadius="md"
      maxH={maxH}
      overflowY="auto"
      borderWidth="1px"
      borderColor="whiteAlpha.100"
    >
      {children}
    </Box>
  );
}

// ============================================================
// 活跃模式：单个事件条目
// ============================================================

interface EventItemProps {
  event: SubagentEvent;
}

const EventItem = React.memo(function EventItem({ event }: EventItemProps) {
  const time = new Date(event.timestamp).toLocaleTimeString();

  const formattedArgs = useMemo(
    () => formatJsonSafe(event.payload?.arguments || ''),
    [event.payload?.arguments],
  );

  if (event.type === 'status_change') {
    const to = event.payload?.to || 'unknown';
    const color =
      to === 'completed'
        ? 'green.400'
        : to === 'failed'
          ? 'red.400'
          : 'blue.400';
    const scheme =
      to === 'completed' ? 'green' : to === 'failed' ? 'red' : 'blue';
    return (
      <TimelineItem accentColor={color} animate>
        <HStack spacing={2}>
          <Icon as={TbBolt} color={color} boxSize={3.5} flexShrink={0} />
          <Badge
            colorScheme={scheme}
            fontSize="xs"
            variant="subtle"
            flexShrink={0}
          >
            {to}
          </Badge>
          {event.payload?.step !== undefined && (
            <Text fontSize="xs" color="text.secondary">
              step {event.payload.step}
            </Text>
          )}
          <Text fontSize="xs" color="text.secondary" ml="auto" flexShrink={0}>
            {time}
          </Text>
        </HStack>
      </TimelineItem>
    );
  }

  if (event.type === 'tool_call') {
    return (
      <TimelineItem accentColor="orange.400" animate>
        <HStack spacing={2}>
          <Icon as={TbTool} color="orange.400" boxSize={3.5} flexShrink={0} />
          <Badge colorScheme="orange" fontSize="xs" flexShrink={0}>
            tool_call
          </Badge>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="orange.200"
            isTruncated
            flex={1}
            fontFamily="mono"
          >
            {event.payload?.toolName || 'unknown'}
          </Text>
          <Text fontSize="xs" color="text.secondary" flexShrink={0}>
            {time}
          </Text>
        </HStack>
        {formattedArgs && (
          <ContentBlock maxH="180px">
            <Text
              as="pre"
              fontSize="xs"
              fontFamily="mono"
              color="whiteAlpha.700"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
            >
              {formattedArgs}
            </Text>
          </ContentBlock>
        )}
      </TimelineItem>
    );
  }

  if (event.type === 'tool_result') {
    return (
      <TimelineItem accentColor="green.400" animate>
        <HStack spacing={2}>
          <Icon as={TbCheck} color="green.400" boxSize={3.5} flexShrink={0} />
          <Badge
            colorScheme="green"
            fontSize="xs"
            variant="subtle"
            flexShrink={0}
          >
            tool_result
          </Badge>
          {/* <Text fontSize="xs" color="text.secondary" isTruncated flex={1}>
            {event.payload?.toolId || '—'}
          </Text> */}
          <Text flex={1}></Text>
          <Text fontSize="xs" color="text.secondary" flexShrink={0}>
            {time}
          </Text>
        </HStack>
      </TimelineItem>
    );
  }

  if (event.type === 'error') {
    return (
      <TimelineItem accentColor="red.400" animate>
        <HStack spacing={2}>
          <Icon as={TbX} color="red.400" boxSize={3.5} flexShrink={0} />
          <Badge
            colorScheme="red"
            fontSize="xs"
            variant="subtle"
            flexShrink={0}
          >
            error
          </Badge>
          <Text fontSize="sm" color="red.300" isTruncated flex={1}>
            {event.payload?.message || 'Unknown error'}
          </Text>
          <Text fontSize="xs" color="text.secondary" flexShrink={0}>
            {time}
          </Text>
        </HStack>
      </TimelineItem>
    );
  }

  return (
    <TimelineItem accentColor="yellow.400" animate>
      <HStack spacing={2}>
        <Badge
          colorScheme="yellow"
          fontSize="xs"
          variant="subtle"
          flexShrink={0}
        >
          {event.type}
        </Badge>
        <Text fontSize="xs" color="text.secondary" flexShrink={0}>
          {time}
        </Text>
      </HStack>
    </TimelineItem>
  );
});

// ============================================================
// 活跃模式：事件时间线
// ============================================================

interface ActiveTimelineProps {
  taskId: string;
}

const ActiveTimeline = React.memo(function ActiveTimeline({
  taskId,
}: ActiveTimelineProps) {
  // 哨兵 div，始终滚动到它即可，不依赖外层滚动容器
  const bottomRef = useRef<HTMLDivElement>(null);

  const events = useSubagentEventStore((s) =>
    s.events.filter((e) => e.taskId === taskId),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <HStack spacing={3} py={6} justify="center">
        <Box
          w="6px"
          h="6px"
          borderRadius="full"
          bg="blue.400"
          sx={{ animation: `${pulse} 1.4s ease-in-out infinite` }}
        />
        <Text fontSize="sm" color="text.secondary">
          Waiting for events…
        </Text>
      </HStack>
    );
  }

  return (
    <Box px={2}>
      {events.map((event, index) => (
        <EventItem key={`${event.timestamp}-${index}`} event={event} />
      ))}
      {/* 末尾脉冲提示正在运行 */}
      <HStack spacing={2} pl={5} pt={1} pb={2}>
        <Box
          w="6px"
          h="6px"
          borderRadius="full"
          bg="blue.400"
          sx={{ animation: `${pulse} 1.2s ease-in-out infinite` }}
        />
        <Text fontSize="xs" color="blue.400">
          Running…
        </Text>
      </HStack>
      {/* 哨兵：自动滚动目标 */}
      <div ref={bottomRef} />
    </Box>
  );
});

// ============================================================
// 历史模式：tool_call + tool_result 内联卡片
// ============================================================

interface InlineToolCallProps {
  tc: ToolCall;
  result: ToolResult | undefined;
}

const InlineToolCall = React.memo(function InlineToolCall({
  tc,
  result,
}: InlineToolCallProps) {
  const formatted = useMemo(
    () => formatJsonSafe(tc.function.arguments || ''),
    [tc.function.arguments],
  );

  const isError = result?.isError;
  const resultContent = result?.content || '';
  const hasResult = result !== undefined;

  return (
    <Box
      borderRadius="lg"
      overflow="hidden"
      borderWidth="1px"
      borderColor={isError ? 'red.700' : 'whiteAlpha.150'}
      bg="whiteAlpha.50"
    >
      {/* tool_call 行 */}
      <HStack
        px={3}
        py={2}
        spacing={2}
        borderBottomWidth={formatted || hasResult ? '1px' : 0}
        borderColor={isError ? 'red.700' : 'whiteAlpha.100'}
        bg="orange.900"
      >
        <Icon as={TbTool} color="orange.300" boxSize={3.5} flexShrink={0} />
        <Badge
          colorScheme="orange"
          fontSize="xs"
          variant="subtle"
          flexShrink={0}
        >
          tool_call
        </Badge>
        <Text
          fontSize="sm"
          fontWeight="semibold"
          color="orange.200"
          fontFamily="mono"
          isTruncated
          flex={1}
        >
          {tc.function.name}
        </Text>
      </HStack>

      {/* arguments */}
      {formatted && (
        <Box
          px={3}
          py={2}
          maxH="160px"
          overflowY="auto"
          borderBottomWidth={hasResult ? '1px' : 0}
          borderColor={isError ? 'red.700' : 'whiteAlpha.100'}
        >
          <Text
            as="pre"
            fontSize="xs"
            fontFamily="mono"
            color="whiteAlpha.600"
            whiteSpace="pre-wrap"
            wordBreak="break-all"
          >
            {formatted}
          </Text>
        </Box>
      )}

      {/* tool_result */}
      {hasResult && (
        <>
          <HStack
            px={3}
            py={1.5}
            spacing={2}
            bg={isError ? 'red.900' : 'green.900'}
            borderBottomWidth={resultContent ? '1px' : 0}
            borderColor={isError ? 'red.700' : 'whiteAlpha.100'}
          >
            <Icon
              as={isError ? TbX : TbCheck}
              color={isError ? 'red.400' : 'green.400'}
              boxSize={3.5}
              flexShrink={0}
            />
            <Badge
              colorScheme={isError ? 'red' : 'green'}
              fontSize="xs"
              variant="subtle"
              flexShrink={0}
            >
              tool_result
            </Badge>
          </HStack>
          {resultContent && (
            <Box px={3} py={2} maxH="200px" overflowY="auto">
              <Text
                as="pre"
                fontSize="xs"
                fontFamily="mono"
                color={isError ? 'red.300' : 'whiteAlpha.600'}
                whiteSpace="pre-wrap"
                wordBreak="break-all"
              >
                {resultContent}
              </Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
});

// ============================================================
// 历史模式：单条消息
// ============================================================

interface HistoryMessageItemProps {
  message: ChatMessage;
  index: number;
  /** tool_call_id → ToolResult，由父组件预构建传入 */
  toolResultMap: Map<string, ToolResult>;
}

const HistoryMessageItem = React.memo(function HistoryMessageItem({
  message,
  toolResultMap,
}: HistoryMessageItemProps) {
  const { role, content, tool_calls, reasoning_content } = message;

  const textContent = useMemo(() => extractTextContent(content), [content]);

  // ---- assistant ----
  if (role === 'assistant') {
    const hasBody = !!(reasoning_content || textContent || tool_calls?.length);
    return (
      <TimelineItem accentColor="blue.400">
        {/* 角色标签 */}
        <HStack spacing={2} mb={hasBody ? 2 : 0}>
          <Icon as={TbRobot} color="blue.400" boxSize={4} flexShrink={0} />
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="blue.300"
            letterSpacing="wider"
            textTransform="uppercase"
          >
            Assistant
          </Text>
        </HStack>

        {/* reasoning */}
        {reasoning_content && (
          <Box
            mb={2}
            px={3}
            py={2}
            borderRadius="md"
            bg="purple.900"
            borderWidth="1px"
            borderColor="purple.700"
            borderLeftWidth="3px"
            borderLeftColor="purple.400"
          >
            <HStack spacing={1.5} mb={1.5}>
              <Icon as={TbBrain} color="purple.300" boxSize={3} />
              <Text
                fontSize="xs"
                color="purple.300"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Reasoning
              </Text>
            </HStack>
            <Text
              as="pre"
              fontSize="xs"
              fontFamily="mono"
              color="purple.200"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
              maxH="160px"
              overflowY="auto"
            >
              {reasoning_content}
            </Text>
          </Box>
        )}

        {/* 文本内容 */}
        {textContent && (
          <Box
            mb={tool_calls?.length ? 2 : 0}
            px={3}
            py={2.5}
            borderRadius="md"
            bg="blue.900"
            borderWidth="1px"
            borderColor="blue.800"
            borderLeftWidth="3px"
            borderLeftColor="blue.400"
            maxH="300px"
            overflowY="auto"
          >
            <Text
              as="pre"
              fontSize="sm"
              fontFamily="sans-serif"
              color="blue.100"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              lineHeight="1.7"
            >
              {textContent}
            </Text>
          </Box>
        )}

        {/* tool calls */}
        {tool_calls && tool_calls.length > 0 && (
          <VStack align="stretch" spacing={2}>
            {tool_calls.map((tc: ToolCall) => (
              <InlineToolCall
                key={tc.id}
                tc={tc}
                result={toolResultMap.get(tc.id)}
              />
            ))}
          </VStack>
        )}
      </TimelineItem>
    );
  }

  // ---- tool：已内联到 assistant，跳过独立渲染 ----
  if (role === 'tool') return null;

  // ---- user ----
  if (role === 'user') {
    return (
      <TimelineItem accentColor="purple.400">
        <HStack spacing={2} mb={textContent ? 2 : 0}>
          <Icon as={TbUser} color="purple.400" boxSize={4} flexShrink={0} />
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="purple.300"
            letterSpacing="wider"
            textTransform="uppercase"
          >
            User
          </Text>
        </HStack>
        {textContent && (
          <Box
            px={3}
            py={2.5}
            borderRadius="md"
            bg="purple.900"
            borderWidth="1px"
            borderColor="purple.800"
            borderLeftWidth="3px"
            borderLeftColor="purple.400"
            maxH="200px"
            overflowY="auto"
          >
            <Text
              as="pre"
              fontSize="sm"
              fontFamily="sans-serif"
              color="purple.100"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              lineHeight="1.7"
            >
              {textContent}
            </Text>
          </Box>
        )}
      </TimelineItem>
    );
  }

  // ---- system ----
  return null
  // return (
  //   <TimelineItem accentColor="gray.500">
  //     <HStack spacing={2} mb={textContent ? 1.5 : 0} opacity={0.6}>
  //       <Icon as={TbSettings} color="gray.400" boxSize={3.5} flexShrink={0} />
  //       <Text
  //         fontSize="xs"
  //         fontWeight="semibold"
  //         color="gray.400"
  //         letterSpacing="wider"
  //         textTransform="uppercase"
  //       >
  //         System
  //       </Text>
  //     </HStack>
  //     {textContent && (
  //       <Box
  //         px={3}
  //         py={2}
  //         borderRadius="md"
  //         bg="whiteAlpha.50"
  //         borderWidth="1px"
  //         borderColor="whiteAlpha.100"
  //         maxH="120px"
  //         overflowY="auto"
  //         opacity={0.6}
  //       >
  //         <Text
  //           as="pre"
  //           fontSize="xs"
  //           fontFamily="sans-serif"
  //           color="gray.300"
  //           whiteSpace="pre-wrap"
  //           wordBreak="break-word"
  //         >
  //           {textContent}
  //         </Text>
  //       </Box>
  //     )}
  //   </TimelineItem>
  // );
});

// ============================================================
// 历史模式：消息时间线
// ============================================================

interface HistoryTimelineProps {
  session: ChatSession | null;
  loading: boolean;
  error: string;
}

const HistoryTimeline = React.memo(function HistoryTimeline({
  session,
  loading,
  error,
}: HistoryTimelineProps) {
  const messages = useMemo(
    () => session?.data?.messages || [],
    [session?.data?.messages],
  );

  // 预构建 tool_call_id → ToolResult 映射，供 assistant 消息内联展示
  const toolResultMap = useMemo(() => {
    const map = new Map<string, ToolResult>();
    for (const msg of messages) {
      if (msg.role !== 'tool') continue;
      const callId = msg.tool_call_id;
      if (!callId) continue;

      const fallbackContent = extractTextContent(msg.content);
      let result: ToolResult | undefined;

      if (msg.tool_result) {
        const firstEntry = Object.values(msg.tool_result)[0] as
          | ToolResult
          | undefined;
        result = firstEntry;
      }

      map.set(callId, {
        path: result?.path || '',
        content: result?.content || fallbackContent,
        isError: result?.isError,
        extra: result?.extra,
      });
    }
    return map;
  }, [messages]);
  if (loading) {
    return (
      <HStack spacing={3} py={6} justify="center">
        <Spinner size="sm" color="blue.400" />
        <Text fontSize="sm" color="text.secondary">
          Loading…
        </Text>
      </HStack>
    );
  }

  if (error) {
    return (
      <HStack spacing={2} py={4} px={2}>
        <Icon as={TbX} color="red.400" boxSize={4} />
        <Text fontSize="sm" color="red.400">
          {error}
        </Text>
      </HStack>
    );
  }

  if (messages.length === 0) {
    return (
      <HStack spacing={2} py={6} justify="center">
        <Icon as={TbCircleDot} color="gray.500" boxSize={4} />
        <Text fontSize="sm" color="text.secondary">
          No messages recorded.
        </Text>
      </HStack>
    );
  }

  return (
    <Box px={2}>
      {messages.map((msg, index) => (
        <HistoryMessageItem
          key={msg.id || index}
          message={msg}
          index={index}
          toolResultMap={toolResultMap}
        />
      ))}
      {/* 末尾完成标记，与 ActiveTimeline 风格一致 */}
      <HStack spacing={2} pl={5} pt={1} pb={4}>
        <Box
          w="6px"
          h="6px"
          borderRadius="full"
          bg="green.400"
          boxShadow="0 0 6px rgba(72,187,120,0.6)"
        />
        <Text fontSize="xs" color="green.400">
          Completed
        </Text>
      </HStack>
    </Box>
  );
});

// ============================================================
// TaskDetailModal 主组件
// ============================================================

export function TaskDetailModal({
  isOpen,
  onClose,
  taskId,
  isActive,
  agentName,
  description,
  session,
  loading,
  error,
}: TaskDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(4px)" />
      <ModalContent
        borderRadius={0}
        m={0}
        display="flex"
        flexDirection="column"
        h="100vh"
        bg="gray.900"
      >
        {/* Header */}
        <ModalHeader
          flexShrink={0}
          borderBottomWidth="1px"
          borderColor="whiteAlpha.100"
          px={6}
          py={4}
          bg="gray.900"
        >
          <HStack spacing={3} pr={8}>
            {/* 左侧 AI 图标 */}
            <Box
              w="36px"
              h="36px"
              borderRadius="lg"
              bg="blue.900"
              borderWidth="1px"
              borderColor="blue.700"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              {isActive ? (
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="full"
                  bg="blue.400"
                  sx={{ animation: `${pulse} 1.2s ease-in-out infinite` }}
                />
              ) : (
                <Icon as={TbRobot} color="blue.400" boxSize={4} />
              )}
            </Box>

            <VStack align="start" spacing={0} flex={1} minW={0}>
              <HStack spacing={2}>
                <Text
                  fontSize="md"
                  fontWeight="semibold"
                  color="white"
                  noOfLines={1}
                >
                  {agentName}
                </Text>
                {isActive && (
                  <Badge colorScheme="blue" fontSize="xs" variant="subtle">
                    Running
                  </Badge>
                )}
              </HStack>
              {description && (
                <Text
                  fontSize="sm"
                  color="whiteAlpha.600"
                  fontWeight="normal"
                  noOfLines={1}
                >
                  {description}
                </Text>
              )}
            </VStack>
          </HStack>
        </ModalHeader>

        <ModalCloseButton color="whiteAlpha.600" top={4} right={4} />

        {/* Body */}
        <ModalBody
          flex={1}
          overflowY="auto"
          px={6}
          py={5}
          sx={{
            '&::-webkit-scrollbar': { width: '5px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              borderRadius: '4px',
              background: 'transparent',
            },
            '&:hover::-webkit-scrollbar-thumb': {
              background: 'rgba(255,255,255,0.15)',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: 'rgba(255,255,255,0.25)',
            },
          }}
        >
          {isActive ? (
            <ActiveTimeline taskId={taskId} />
          ) : (
            <HistoryTimeline
              session={session}
              loading={loading}
              error={error}
            />
          )}
        </ModalBody>

        {/* Footer 分隔线 */}
        <Divider borderColor="whiteAlpha.100" />
        <HStack
          px={6}
          py={2.5}
          justify="space-between"
          bg="gray.900"
          flexShrink={0}
        >
          <Text fontSize="xs" color="whiteAlpha.400">
            Task ID: {taskId || '—'}
          </Text>
          {isActive && (
            <HStack spacing={1.5}>
              <Box
                w="5px"
                h="5px"
                borderRadius="full"
                bg="green.400"
                sx={{ animation: `${pulse} 1s ease-in-out infinite` }}
              />
              <Text fontSize="xs" color="green.400">
                Live
              </Text>
            </HStack>
          )}
        </HStack>
      </ModalContent>
    </Modal>
  );
}

export default TaskDetailModal;