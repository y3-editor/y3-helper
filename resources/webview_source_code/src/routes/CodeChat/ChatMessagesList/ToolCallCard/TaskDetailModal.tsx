/**
 * TaskDetailModal - Subagent 任务详情弹窗
 */

import * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
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
  TbUser,
  TbCheck,
  TbX,
  TbCircleDot,
  TbBrain,
} from 'react-icons/tb';
import { RiRobot2Line } from 'react-icons/ri';

import { ChatMessage, ToolCall, ToolResult } from '../../../../services';
import { useSubagentStore } from '../../../../modules/subagent';
import TaskCompressionSummary from './TaskCompressionSummary';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

export interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  isActive: boolean;
  agentName: string;
  description: string;
  loading: boolean;
  error: string;
}

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
      <Box flex={1} minW={0} pb={2}>
        {children}
      </Box>
    </Box>
  );
}

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

interface CompactToolCallProps {
  tc: ToolCall;
  result: ToolResult | undefined;
}

const CompactToolCall = React.memo(function CompactToolCall({
  tc,
  result,
}: CompactToolCallProps) {
  const [expanded, setExpanded] = React.useState(false);

  const formatted = useMemo(
    () => formatJsonSafe(tc.function.arguments || ''),
    [tc.function.arguments],
  );

  const isError = result?.isError;
  const resultContent = result?.content || '';
  const hasResult = result !== undefined;
  const hasExpandableContent = Boolean(formatted || resultContent);

  const handleToggleExpand = React.useCallback(() => {
    if (hasExpandableContent) {
      setExpanded(!expanded);
    }
  }, [hasExpandableContent, expanded]);

  return (
    <TimelineItem
      accentColor={isError ? 'red.400' : hasResult ? 'green.400' : 'orange.400'}
    >
      <HStack
        spacing={2}
        cursor={hasExpandableContent ? 'pointer' : 'default'}
        onClick={handleToggleExpand}
        _hover={{
          bg: hasExpandableContent ? 'whiteAlpha.50' : 'transparent',
        }}
        borderRadius="md"
        px={hasExpandableContent ? 2 : 0}
        py={hasExpandableContent ? 1 : 0}
        mx={hasExpandableContent ? -2 : 0}
        my={hasExpandableContent ? -1 : 0}
        transition="background-color 0.15s ease"
      >
        <Icon as={TbTool} color="orange.400" boxSize={4} flexShrink={0} />
        <Badge
          colorScheme="orange"
          fontSize="xs"
          variant="subtle"
          flexShrink={0}
        >
          tool
        </Badge>
        <Text
          fontSize="sm"
          fontWeight="medium"
          color="orange.200"
          fontFamily="mono"
          isTruncated
          flex={1}
        >
          {tc.function.name}
        </Text>
        {hasResult && (
          <Icon
            as={isError ? TbX : TbCheck}
            color={isError ? 'red.400' : 'green.400'}
            boxSize={3}
            flexShrink={0}
          />
        )}
        {hasExpandableContent && (
          <Box
            fontSize="xs"
            color="whiteAlpha.500"
            flexShrink={0}
            transition="color 0.15s ease"
          >
            {expanded ? '▼' : '▶'}
          </Box>
        )}
      </HStack>

      {expanded && hasExpandableContent && (
        <ContentBlock maxH="150px" bg="whiteAlpha.30">
          {formatted && (
            <Box mb={resultContent ? 2 : 0}>
              <Text
                fontSize="10px"
                color="orange.300"
                fontWeight="medium"
                mb={1}
              >
                ARGS
              </Text>
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
          {resultContent && (
            <Box>
              <Text
                fontSize="10px"
                color={isError ? 'red.300' : 'green.300'}
                fontWeight="medium"
                mb={1}
              >
                {isError ? 'ERROR' : 'RESULT'}
              </Text>
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
        </ContentBlock>
      )}
    </TimelineItem>
  );
});

interface CompactMessageItemProps {
  message: ChatMessage;
  index: number;
  toolResultMap: Map<string, ToolResult>;
  isLastAssistant?: boolean;
}

const CompactMessageItem = React.memo(function CompactMessageItem({
  message,
  toolResultMap,
}: CompactMessageItemProps) {
  const { role, content, tool_calls, reasoning_content } = message;

  const isCompressionSummary = message.isCompressionSummary || false;
  const textContent = useMemo(() => extractTextContent(content), [content]);

  if (isCompressionSummary) {
    return <TaskCompressionSummary message={message} />;
  }

  if (role === 'assistant') {
    return (
      <>
        {reasoning_content && (
          <TimelineItem accentColor="purple.400">
            <HStack spacing={2}>
              <Icon
                as={TbBrain}
                color="purple.400"
                boxSize={4}
                flexShrink={0}
              />
              <Badge
                colorScheme="purple"
                fontSize="xs"
                variant="subtle"
                flexShrink={0}
              >
                reasoning
              </Badge>
            </HStack>
            <ContentBlock maxH="120px" bg="purple.900">
              <Text
                as="pre"
                fontSize="xs"
                fontFamily="mono"
                color="purple.200"
                whiteSpace="pre-wrap"
                wordBreak="break-all"
              >
                {reasoning_content}
              </Text>
            </ContentBlock>
          </TimelineItem>
        )}

        {textContent && (
          <TimelineItem accentColor="blue.400">
            <HStack spacing={2}>
              <Icon
                as={RiRobot2Line}
                color="blue.400"
                boxSize={4}
                flexShrink={0}
              />
              <Badge
                colorScheme="blue"
                fontSize="xs"
                variant="subtle"
                flexShrink={0}
              >
                response
              </Badge>
            </HStack>
            <ContentBlock maxH="400px">
              <Text
                as="pre"
                fontSize="sm"
                fontFamily="sans-serif"
                color="blue.100"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                lineHeight="1.6"
              >
                {textContent}
              </Text>
            </ContentBlock>
          </TimelineItem>
        )}

        {tool_calls && tool_calls.length > 0 && (
          <>
            {tool_calls.map((tc: ToolCall) => (
              <CompactToolCall
                key={tc.id}
                tc={tc}
                result={toolResultMap.get(tc.id)}
              />
            ))}
          </>
        )}
      </>
    );
  }

  if (role === 'tool') return null;

  if (role === 'user') {
    return (
      <TimelineItem accentColor="purple.400">
        <HStack spacing={2}>
          <Icon as={TbUser} color="purple.400" boxSize={4} flexShrink={0} />
          <Badge
            colorScheme="purple"
            fontSize="xs"
            variant="subtle"
            flexShrink={0}
          >
            user
          </Badge>
        </HStack>
        {textContent && (
          <ContentBlock maxH="150px">
            <Text
              as="pre"
              fontSize="sm"
              fontFamily="sans-serif"
              color="purple.100"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              lineHeight="1.6"
            >
              {textContent}
            </Text>
          </ContentBlock>
        )}
      </TimelineItem>
    );
  }

  return null;
});

interface UnifiedTimelineProps {
  taskId: string;
  isActive: boolean;
  loading?: boolean;
  error?: string;
}

const UnifiedTimeline = React.memo(function UnifiedTimeline({
  taskId,
  isActive,
  loading = false,
  error = '',
}: UnifiedTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const storeSession = useSubagentStore((s) => s.getSubagentSession(taskId));

  const messages = useMemo(() => {
    return storeSession?.messages || [];
  }, [storeSession?.messages]);

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return i;
      }
    }
    return -1;
  }, [messages]);

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

  const currentStatus = useMemo(() => {
    if (storeSession?.compressionInProgress) {
      return {
        status: 'Compacting',
        color: 'orange.400',
      };
    } else {
      return {
        status: 'Thinking',
        color: 'blue.400',
      };
    }
  }, [storeSession?.compressionInProgress]);

  useEffect(() => {
    if (isActive && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, isActive]);

  if (!isActive && loading) {
    return (
      <HStack spacing={3} py={6} justify="center">
        <Spinner size="sm" color="blue.400" />
        <Text fontSize="sm" color="text.secondary">
          Loading…
        </Text>
      </HStack>
    );
  }

  if (!isActive && error) {
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
    if (isActive) {
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
            Waiting for messages…
          </Text>
        </HStack>
      );
    } else {
      return (
        <HStack spacing={2} py={6} justify="center">
          <Icon as={TbCircleDot} color="gray.500" boxSize={4} />
          <Text fontSize="sm" color="text.secondary">
            No messages recorded.
          </Text>
        </HStack>
      );
    }
  }

  return (
    <Box px={2}>
      {messages.map((msg, index) => (
        <CompactMessageItem
          key={msg.id || index}
          message={msg}
          index={index}
          toolResultMap={toolResultMap}
          isLastAssistant={
            index === lastAssistantIndex && msg.role === 'assistant'
          }
        />
      ))}

      {isActive && (
        <>
          <HStack spacing={2} pl={5} pt={1} pb={2}>
            <Box
              w="6px"
              h="6px"
              borderRadius="full"
              bg={currentStatus.color}
              sx={{ animation: `${pulse} 1.2s ease-in-out infinite` }}
            />
            <Text as="b" fontSize="xs" color={currentStatus.color}>
              {currentStatus.status}...
            </Text>
          </HStack>
          <div ref={bottomRef} />
        </>
      )}
    </Box>
  );
});

export function TaskDetailModal({
  isOpen,
  onClose,
  taskId,
  isActive,
  agentName,
  description,
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
                <Icon as={RiRobot2Line} color="blue.400" boxSize={4} />
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

        <ModalBody
          flex={1}
          overflowY="auto"
          p={4}
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
          <UnifiedTimeline
            taskId={taskId}
            isActive={isActive}
            loading={loading}
            error={error}
          />
        </ModalBody>

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