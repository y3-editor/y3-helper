/**
 * SubagentDebugPanel —— 开发模式下的子代理调试面板
 *
 * 职责：
 * - 展示所有活跃 Runner 的状态卡片（agentName、step/maxSteps、status）
 * - 展示最近 50 条子代理运行时事件流
 * - 通过 import.meta.env.DEV 条件渲染，生产 build 中 tree-shake 掉
 *
 * Task Group 5
 */

import * as React from 'react';
import {
  Box,
  Badge,
  Text,
  VStack,
  HStack,
  Heading,
  Divider,
  IconButton,
  Collapse,
  useDisclosure,
} from '@chakra-ui/react';

import {
  useSubagentStore,
  useSubagentEventStore,
} from '../../modules/subagent';
import type {
  SubagentStatusInfo,
  SubagentStatus,
  SubagentEvent,
  SubagentEventType,
} from '../../modules/subagent';

// ============================================================
// 常量
// ============================================================

/** 展示最近事件的数量上限 */
const MAX_DISPLAY_EVENTS = 50;

// ============================================================
// 辅助函数
// ============================================================

/** 根据状态返回 Badge 颜色 */
function getStatusColor(status: SubagentStatus): string {
  switch (status) {
    case 'pending':
      return 'gray';
    case 'running':
      return 'blue';
    case 'waiting_tool':
      return 'yellow';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'aborted':
      return 'orange';
    default:
      return 'gray';
  }
}

/** 根据事件类型返回 Badge 颜色 */
function getEventTypeColor(type: SubagentEventType): string {
  switch (type) {
    case 'status_change':
      return 'blue';
    case 'tool_call':
      return 'purple';
    case 'tool_result':
      return 'green';
    case 'error':
      return 'red';
    case 'timeout':
      return 'orange';
    default:
      return 'gray';
  }
}

/** 格式化时间戳为可读的时分秒毫秒 */
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + `.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** 格式化事件负载为简洁的摘要字符串 */
function formatPayload(payload?: Record<string, any>): string {
  if (!payload) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    parts.push(`${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
  return parts.join(' ');
}

// ============================================================
// 子组件：Runner 状态卡片
// ============================================================

interface RunnerCardProps {
  taskId: string;
  info: SubagentStatusInfo;
}

const RunnerCard = React.memo(function RunnerCard({ taskId, info }: RunnerCardProps) {
  return (
    <Box
      p={2}
      borderWidth="1px"
      borderRadius="md"
      borderColor="gray.600"
      bg="gray.800"
      fontSize="xs"
    >
      <HStack justify="space-between" mb={1}>
        <Text fontWeight="bold" color="white" isTruncated maxW="120px">
          {info.agentName || 'Unknown'}
        </Text>
        <Badge colorScheme={getStatusColor(info.status)} size="sm">
          {info.status}
        </Badge>
      </HStack>
      <Text color="gray.400" fontSize="2xs" isTruncated>
        {taskId.slice(0, 12)}…
      </Text>
      <HStack mt={1} spacing={2}>
        <Text color="gray.300" fontSize="2xs">
          Step: {info.step}/{info.maxSteps}
        </Text>
      </HStack>
      {info.description && (
        <Text color="gray.500" fontSize="2xs" mt={1} isTruncated>
          {info.description}
        </Text>
      )}
    </Box>
  );
});

// ============================================================
// 子组件：事件行
// ============================================================

interface EventRowProps {
  event: SubagentEvent;
}

const EventRow = React.memo(function EventRow({ event }: EventRowProps) {
  return (
    <HStack spacing={2} py={0.5} fontSize="2xs" align="flex-start">
      <Text color="gray.500" flexShrink={0} fontFamily="mono">
        {formatTimestamp(event.timestamp)}
      </Text>
      <Badge
        colorScheme={getEventTypeColor(event.type)}
        size="sm"
        flexShrink={0}
        fontSize="2xs"
      >
        {event.type}
      </Badge>
      <Text color="gray.400" isTruncated fontFamily="mono">
        {event.taskId.slice(0, 8)}
      </Text>
      <Text color="gray.300" isTruncated flex={1}>
        {formatPayload(event.payload)}
      </Text>
    </HStack>
  );
});

// ============================================================
// 主组件
// ============================================================

function SubagentDebugPanel() {
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: false });
  const statuses = useSubagentStore((s) => s.statuses);
  const events = useSubagentEventStore((s) => s.events);

  // 从事件列表尾部取最近 50 条
  const recentEvents = React.useMemo(() => {
    const start = Math.max(0, events.length - MAX_DISPLAY_EVENTS);
    return events.slice(start).reverse();
  }, [events]);

  const statusEntries = React.useMemo(() => {
    return Object.entries(statuses);
  }, [statuses]);

  const activeCount = React.useMemo(() => {
    return statusEntries.filter(
      ([, info]) => info.status === 'running' || info.status === 'pending' || info.status === 'waiting_tool',
    ).length;
  }, [statusEntries]);

  return (
    <Box
      position="fixed"
      bottom={0}
      right={0}
      zIndex={9999}
      maxW="420px"
      maxH={isOpen ? '60vh' : 'auto'}
      bg="gray.900"
      color="white"
      borderTopLeftRadius="md"
      boxShadow="dark-lg"
      overflow="hidden"
      fontSize="xs"
    >
      {/* Header bar */}
      <HStack
        px={3}
        py={1.5}
        bg="gray.700"
        cursor="pointer"
        onClick={onToggle}
        justify="space-between"
        userSelect="none"
      >
        <HStack spacing={2}>
          <Text fontWeight="bold" fontSize="xs">
            🤖 Subagent Debug
          </Text>
          {activeCount > 0 && (
            <Badge colorScheme="green" fontSize="2xs">
              {activeCount} active
            </Badge>
          )}
          <Badge colorScheme="gray" fontSize="2xs">
            {events.length} events
          </Badge>
        </HStack>
        <IconButton
          aria-label="Toggle debug panel"
          icon={
            <Text fontSize="xs">{isOpen ? '▼' : '▲'}</Text>
          }
          size="xs"
          variant="ghost"
          colorScheme="whiteAlpha"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      </HStack>

      <Collapse in={isOpen} animateOpacity>
        <Box overflowY="auto" maxH="calc(60vh - 36px)" px={3} py={2}>
          {/* Runner 状态卡片 */}
          {statusEntries.length > 0 && (
            <>
              <Heading size="xs" color="gray.300" mb={2}>
                Runners ({statusEntries.length})
              </Heading>
              <VStack spacing={2} align="stretch" mb={3}>
                {statusEntries.map(([taskId, info]) => (
                  <RunnerCard key={taskId} taskId={taskId} info={info} />
                ))}
              </VStack>
              <Divider borderColor="gray.600" mb={2} />
            </>
          )}

          {/* 事件流 */}
          <Heading size="xs" color="gray.300" mb={2}>
            Recent Events ({Math.min(events.length, MAX_DISPLAY_EVENTS)})
          </Heading>
          {recentEvents.length === 0 ? (
            <Text color="gray.500" fontSize="2xs">
              No events recorded yet.
            </Text>
          ) : (
            <VStack spacing={0} align="stretch">
              {recentEvents.map((event, idx) => (
                <EventRow key={`${event.timestamp}-${idx}`} event={event} />
              ))}
            </VStack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export default SubagentDebugPanel;