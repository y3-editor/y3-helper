import * as React from 'react';
import {
  Box,
  Button,
  Spinner,
  Link,
} from '@chakra-ui/react';
import { FaAngleRight, FaAngleDown } from 'react-icons/fa6';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import { usePostMessage } from '../../../PostMessageProvider';
import { ChatAssistantMessageProps } from './types';
import { ChatMessageAttachType, CodeBaseMeta } from '../../../services';
import Markdown from '../../../components/Markdown';
import ChatCodeBlock from '../ChatCodeBlock';
import Icon from '../../../components/Icon';
import CodeSearchBlock from '../CodeSearchBlock';
import { unionBy } from 'lodash';
import { convertStringToMarkdown } from '../../../utils';
import ToolCall from './ToolCall';
import Retry from './Retry';

const AssistantMessage: React.FC<ChatAssistantMessageProps> = (props) => {
  const { message, isLatest, isRecent, attachs, isShare, setRecommendFileChanges } = props;
  const { postMessage } = usePostMessage();
  const [expand, setExpand] = React.useState(false);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const isError = useChatStore((state) => state.isError);

  const data = { message, defaultExpanded: isLatest };

  const renderAttachs = React.useMemo(() => {
    if (!attachs) return;
    if (attachs[0]?.type === ChatMessageAttachType.CodeBase) {
      const { searchResult } = attachs[0] as CodeBaseMeta;
      return (
        <Box>
          {searchResult?.length ? (
            <Box mb="2">
              搜索返回 {searchResult.length} 条相关代码段，
              <Button
                color="blue.300"
                variant="link"
                onClick={() => {
                  setExpand(!expand);
                }}
              >
                {!expand ? '展开' : '收起'}详情
              </Button>
            </Box>
          ) : null}
          {expand
            ? searchResult.map((item, index) => (
              <CodeSearchBlock data={item} index={index} key={index} />
            ))
            : null}
        </Box>
      );
    }
  }, [attachs, expand]);

  const openInBrowser = React.useCallback(
    (url: string) => {
      postMessage({
        type: 'OPEN_IN_BROWSER',
        data: {
          url,
        },
      });
    },
    [postMessage],
  );

  const webSearch = React.useMemo(() => {
    if (!message?.webSearch?.length) return [];
    return message.webSearch
      .map((i) => i.web)
      .filter((webItem) => webItem?.uri);
  }, [message]);

  const bmSearch = React.useMemo(() => {
    if (!message?.bmSearch?.length) return [];
    if (message.bmMark) {
      const formatBmSearch = message.bmSearch.map((i, index) => ({
        ...i,
        rank: index + 1,
      }));
      return formatBmSearch.filter((i) =>
        message.bmSearchSourcesIndex?.includes(i.rank),
      );
    } else {
      // 过滤空数据
      const filterSearch = message.bmSearch.filter((i) => i.attributes?.url);
      // 去重并且加上序号
      return unionBy(filterSearch, 'attributes.url').map((i, index) => ({
        ...i,
        rank: index + 1,
      }));
    }
  }, [message]);

  const showThinkingContent = React.useMemo(() => {
    return (
      message?.reasoningContent?.length || message?.reasoning_content?.length
    );
  }, [message]);

  const messageContent = React.useMemo(() => {
    if (!message.revertedFiles) {
      return message.content || '';
    } else {
      let content = '已完成以下文件内容回退\n\n';
      const paths = Object.keys(message.revertedFiles);
      for (const path of paths) {
        // TODO: 可点击跳转
        // content += `- <a href="file:${path}">${path}</a>\n`;
        // content += `- [${path}](file:${path})\n`;
        content += '- ' + path + '\n';
      }
      return content;
    }
  }, [message.content, message.revertedFiles])

  if (message.isAutoCompressingMessage && !message.content) {
    return (
      <Box
        textAlign="center"
        fontSize="xs"
        color="gray.400"
        opacity={0.5}
        my={2}
        userSelect="none"
      >
        Memory: 正在自动总结上下文
      </Box>
    );
  }

  return (
    <>
      <Box
        color="text.primary"
        data-content={messageContent}
      >
        {renderAttachs}
        {message?.loading ? <Spinner /> : null}
        {showThinkingContent ? (
          <Box>
            <Box
              cursor="pointer"
              color="text.default"
              onClick={() => setIsCollapsed(!isCollapsed)}
              display="flex"
              alignItems="center"
              mb="1"
            >
              {!isCollapsed ? (
                <Icon as={FaAngleDown} size="xs" />
              ) : (
                <Icon as={FaAngleRight} size="xs" />
              )}
              <Box ml="1" color="text.primary">
                思考过程
              </Box>
            </Box>
            {!isCollapsed ? (
              <blockquote className="border-l-4 border-gray-300 pl-4 my-0 mx-0 text-gray-600 italic whitespace-pre-line">
                {message?.reasoningContent || message.reasoning_content}
              </blockquote>
            ) : null}
          </Box>
        ) : null}
        {message.content && message.content !== '-' ? (
          <>
            <Markdown
              data={data}
              CodeRender={ChatCodeBlock}
              onRecommendFileChange={setRecommendFileChanges}
            >
              {
                isStreaming
                  ? (messageContent as string)
                  : convertStringToMarkdown(messageContent as string)
              }
            </Markdown>
          </>
        ) : null}
        {webSearch.length ? (
          <Box mt="4" display="flex" flexDirection="column" gap="2">
            <Box> &gt; 参考链接：</Box>
            {webSearch.map((i, index) => (
              <Link
                color="blue.300"
                href="#"
                onClick={() => {
                  openInBrowser(i.uri);
                }}
                key={index}
              >
                {index + 1}: {i.title}
              </Link>
            ))}
          </Box>
        ) : null}
        {bmSearch.length ? (
          <Box mt="4" display="flex" flexDirection="column" gap="2">
            <Box> &gt; 参考链接：</Box>
            {bmSearch.map((i, index) => {
              if (i.attributes.url) {
                return (
                  <Link
                    color="blue.300"
                    href="#"
                    onClick={() => {
                      openInBrowser(i.attributes.url);
                    }}
                    key={index}
                  >
                    {i.rank}: {i.attributes.filename}
                  </Link>
                );
              } else {
                return (
                  <Box>
                    {i.rank}: {i.attributes.filename}
                  </Box>
                );
              }
            })}
          </Box>
        ) : null}
      </Box>
      {message.tool_calls && message.tool_calls.length ? (
        <ToolCall
          message={message}
          isShare={!!isShare}
          isLatest={!!isLatest}
        />
      ) : null}
      {
        !isShare && isRecent && isError && (
          <Retry userScrollLock={false} />
        )
      }
    </>
  );
};

export default AssistantMessage;
