import { useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { BiBox } from 'react-icons/bi';
import UserMarkdown from '../../../components/Markdown/UserMarkdown';
import ChatCodeBlock from '../ChatCodeBlock';
import { ChatMessage } from './types';
import { useChatStore } from '../../../store/chat';
import userReporter from '../../../utils/report';
import { UserEvent } from '../../../types/report';
import { useTerminalMessage } from './TermialPanel';

interface CompressionMetadata {
  originalMessageCount: number;
  tokensSaved: number;
  compressionRatio: number;
  compressedAt: number;
  originalTokenCount: number;
  compressedTokenCount: number;
}

interface CompressionSummaryProps {
  message: ChatMessage;
}

/**
 * 清理 LLM 生成的响应中的 XML 标签
 * 参考 cleanAnalysisSummaryTags 方法
 * 
 * 将 <analysis>...</analysis> 标签转换为 "Analysis:\n..."
 * 将 <summary>...</summary> 标签转换为 "Summary:\n..."
 */
function cleanAnalysisSummaryTags(rawSummary: string): string {
  let cleaned = rawSummary;

  // 替换 <analysis> 标签
  const analysisMatch = cleaned.match(/<analysis>([\s\S]*?)<\/analysis>/);
  if (analysisMatch) {
    const content = analysisMatch[1] || "";
    cleaned = cleaned.replace(/<analysis>[\s\S]*?<\/analysis>/, `Analysis:\n${content.trim()}`);
  }

  // 替换 <summary> 标签
  const summaryMatch = cleaned.match(/<summary>([\s\S]*?)<\/summary>/);
  if (summaryMatch) {
    const content = summaryMatch[1] || "";
    cleaned = cleaned.replace(/<summary>[\s\S]*?<\/summary>/, `Summary:\n${content.trim()}`);
  }

  // 压缩多余换行符
  cleaned = cleaned.replace(/\n\n+/g, "\n\n");

  return cleaned.trim();
}

/**
 * 提取并格式化压缩内容
 */
function extractCompressionContent(message: ChatMessage): string {
  // 提取原始内容
  const rawContent = typeof message.content === 'string'
    ? message.content
    : Array.isArray(message.content)
      ? message.content.find(c => c.type === 'text')?.text || ''
      : '';

  // 移除 system-reminder 标签
  let cleaned = rawContent.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  // 移除 Compression Summary 标题
  cleaned = cleaned.replace(/### Compression Summary:/g, '');

  // 清理 XML 标签
  cleaned = cleanAnalysisSummaryTags(cleaned);

  return cleaned.trim();
}

/**
 * 压缩总结组件
 */
export default function CompressionSummary({ message }: CompressionSummaryProps) {
  const [isCompressionExpanded, setIsCompressionExpanded] = useState(false);
  const createNewSession = useChatStore((state) => state.onNewSession);
  const { stopRunningTerminal } = useTerminalMessage();

  const compressionContent = extractCompressionContent(message);
  const metadata = message.compressionMetadata as CompressionMetadata | undefined;

  const handleCreateNewSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    userReporter.report({
      event: UserEvent.CODE_CHAT_NEW_SESSION,
    });
    stopRunningTerminal();
    createNewSession();
  };

  return (
    <Box my={4}>
      <Flex
        alignItems="center"
        gap={3}
        fontSize="xs"
        color="whiteAlpha.600"
        cursor="pointer"
        onClick={() => setIsCompressionExpanded(!isCompressionExpanded)}
        _hover={{
          '& .divider-line': { borderColor: 'border.hover' },
          '& .summary-text': { color: 'text.secondary' }
        }}
        userSelect="none"
        position="relative"
      >
        <Box
          className="divider-line"
          flex={1}
          height="1px"
          borderTop="1px dashed"
          transition="border-color 0.2s"
        />

        <Flex
          className="summary-text"
          alignItems="center"
          gap={1.5}
          border="1px solid"
          borderRadius="3xl"
          transition="all 0.2s"
          p={2}
          _hover={{
            borderColor: 'border.hover',
            bg: 'bg.subtle'
          }}
        >
          <BiBox size={15} />
          <Text fontSize="xs" mb={'0 !important'} display="flex" alignItems="center" flexWrap="wrap" gap={1}>
            <Text as="span">Memory：上下文已总结</Text>
            {metadata && (
              <Text as="span" fontSize="2xs" opacity={0.7}>
                (节省 {metadata.tokensSaved.toLocaleString()} tokens)
              </Text>
            )}
            <Text as="span">。新任务建议</Text>
            <Text
              as="span"
              color="purple.400"
              textDecoration="underline"
              onClick={handleCreateNewSession}
            >
              新建对话
            </Text>
            <Text as="span">，避免额外Token消耗</Text>
          </Text>
          {isCompressionExpanded ? (
            <ChevronUpIcon boxSize={5} />
          ) : (
            <ChevronDownIcon boxSize={5} />
          )}
        </Flex>

        <Box
          className="divider-line"
          flex={1}
          height="1px"
          borderTop="1px dashed"
          transition="border-color 0.2s"
        />
      </Flex>

      {/* 折叠/展开的详细内容 */}
      {isCompressionExpanded && compressionContent && (
        <Box
          mt={3}
          px={4}
          py={3}
          bg="bg.subtle"
          borderRadius="md"
          borderLeft="3px solid"
          borderLeftColor="blue.400"
          fontSize="sm"
          color="text.secondary"
          maxHeight="500px"
          overflowY="auto"
        >
          <UserMarkdown data={{ message }} CodeRender={ChatCodeBlock}>
            {compressionContent}
          </UserMarkdown>
        </Box>
      )}

      {isCompressionExpanded && compressionContent && metadata && (
            <Box
              mt={3}
              pt={3}
              borderTop="1px solid"
              borderTopColor="border.default"
              fontSize="xs"
              color="text.muted"
            >
              <Flex gap={4} flexWrap="wrap">
                <Text>压缩消息数: {metadata.originalMessageCount}</Text>
                <Text>压缩比: {metadata.compressionRatio.toFixed(2)}x</Text>
                <Text>
                  压缩时间: {new Date(metadata.compressedAt).toLocaleString('zh-CN')}
                </Text>
              </Flex>
            </Box>
          )}
    </Box>
  );
}
