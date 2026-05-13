import {
  Box,
  Icon,
  IconButton,
  Spinner,
  Tag,
  Tooltip,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { usePostMessage } from '../../../PostMessageProvider';
import { RxCheckCircled, RxCircleBackslash, RxCrossCircled } from 'react-icons/rx';
import { MdExpandLess } from 'react-icons/md';
import { useChatApplyStore } from '../../../store/chatApply';
import MemoCodeBlock from '../../../components/Markdown/CodeBlock';
import MemoDiffCodeBlock from '../../../components/Markdown/DiffCodeBlock';
import { useConfigStore } from '../../../store/config';

interface ClaudeEditFileProps {
  /** 工具类型：write 全量写入 / edit 字符串替换 */
  toolName: 'write' | 'edit';
  messageId?: string;
  toolCallId: string;
  filePath: string;
  isLatest?: boolean;
}

export function ClaudeEditFile(props: ClaudeEditFileProps) {
  const {
    toolName,
    // messageId is reserved for future reporting use
    toolCallId,
    filePath,
    isLatest = false,
  } = props;

  const { postMessage } = usePostMessage();
  const chatApplyInfo = useChatApplyStore((state) => state.chatApplyInfo);
  const codeWhiteSpace = useConfigStore((state) => state.config.codeWhiteSpace);


  const targetApplyItem = chatApplyInfo[toolCallId];
  const [isExpanded, setIsExpanded] = useState(!!targetApplyItem);

  const {
    finalResult = '',
    accepted,
    rejected,
    reverted,
    diffInfo,
    updateSnippet = '',
    isCreateFile,
  } = targetApplyItem || {};

  useEffect(() => {
    if (!targetApplyItem) {
      setIsExpanded(false);
    }
  }, [targetApplyItem]);

  const displayedFilePath = useMemo(() => {
    return filePath || targetApplyItem?.filePath || '';
  }, [filePath, targetApplyItem?.filePath]);

  const fileName = useMemo(() => {
    return displayedFilePath.split('/').slice(-1)[0] || displayedFilePath;
  }, [displayedFilePath]);

  const language = useMemo(() => {
    try {
      return fileName.split('.').slice(-1)[0];
    } catch {
      return 'text';
    }
  }, [fileName]);

  const metaData = useMemo(() => ({ filePath: displayedFilePath }), [displayedFilePath]);

  // 展示的代码（优先展示 diff，否则展示 editSnippet / finalResult）
  const displayedCode = useMemo(() => {
    return updateSnippet || finalResult;
  }, [updateSnippet, finalResult]);


  const operationLabel = useMemo(() => {
    if (isCreateFile) return '创建';
    if (toolName === 'write') return '写入';
    return '编辑';
  }, [isCreateFile, toolName]);

  return (
    <div className="markdown-body">
      <Box bg="answerBgColor">
        <Box
          h="28px"
          display="flex"
          alignItems="center"
          px="2"
          bg="answerBgColor"
          border="1px"
          borderColor="customBorder"
          borderTopRadius="8px"
          color="text.default"
          fontSize="12px"
        >
          {/* 左侧：展开/折叠 + 操作类型 + 文件名 + 行数徽章 */}
          <Box display="flex" alignItems="center" overflow="hidden" minWidth="0" flex="1">
            <IconButton
              aria-label="展开/折叠"
              size="md"
              variant="link"
              icon={<MdExpandLess className={`${isExpanded ? 'rotate-180' : 'rotate-90'} transition-all duration-200 ease-in-out`} />}
              onClick={() => setIsExpanded(!isExpanded)}
              minW="18px"
              h="24px"
              p={0}
            />
            <Tooltip label={displayedFilePath} placement="top">
              <Box
                color="blue.300"
                cursor="pointer"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                display="inline-block"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  postMessage({
                    type: 'OPEN_FILE',
                    data: {
                      filePath: displayedFilePath
                    },
                  });
                }}
              >
                {fileName}
              </Box>
            </Tooltip>
            <Tag mr={1} ml={2} style={{ zoom: .7 }}>
              {operationLabel}
            </Tag>
          </Box>

          {/* 右侧：状态 + 操作按钮 */}
          <div className="flex items-center ml-auto">
            {accepted && (
              <Box color="green.500" display="flex" alignItems="center" ml={1} mr={2} flexShrink={0}>
                <Icon as={RxCheckCircled} />
                <Box fontSize={12} ml={1}>已应用</Box>
              </Box>
            )}
            {rejected && (
              <Box color="red.400" display="flex" alignItems="center" mr={2} flexShrink={0}>
                <Icon as={RxCrossCircled} />
                <Box fontSize={12} ml={1}>已拒绝</Box>
              </Box>
            )}
            {reverted && (
              <Box color="gray.400" display="flex" alignItems="center" ml={2}>
                <Icon as={RxCircleBackslash} />
                <Box fontSize={12} ml={1}>已回退</Box>
              </Box>
            )}
          </div>
        </Box>
      </Box>
      <pre>
        {
          isLatest && targetApplyItem?.applying && (
            <Box
              display="flex"
              alignItems="center"
              px="2"
              py="3"
              borderX="1px"
              borderBottom="1px"
              borderColor="customBorder"
              borderBottomRadius="8px"
              bg="answerBgColor"
              color="text.default"
              fontSize="12px"
            >
              <Spinner size="xs" mr="6px" />
              代码生成中，请稍候... (文件较大或内容复杂时，生成速度可能会慢一些，感谢您的耐心等待 🙏)
            </Box>
          )
        }
        {isExpanded && diffInfo && !targetApplyItem?.applying && (
          <MemoDiffCodeBlock
            language={language}
            value={diffInfo.content || ''}
            addedLines={diffInfo.added || []}
            removedLines={diffInfo.removed || []}
            lineNumbers={diffInfo.lineNumbers}
            collapsable
            metaData={metaData}
            codeWhiteSpace={codeWhiteSpace}
          />
        )}
        {isExpanded && !diffInfo && displayedCode && !targetApplyItem?.applying && (
          <MemoCodeBlock
            language={language}
            value={displayedCode}
            collapsable
            metaData={metaData}
            codeWhiteSpace={codeWhiteSpace}
          />
        )}
      </pre>
    </div>
  );
}