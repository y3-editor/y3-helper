import { Box, Divider, Flex, Icon, Spinner, Text } from "@chakra-ui/react";
import { ChatMessage } from "../../../services";
import { RxCheckCircled, RxCircleBackslash } from "react-icons/rx";
import { TbCube } from "react-icons/tb";
import { useChatStreamStore } from "../../../store/chat";
import { useCallback, useMemo, memo } from "react";
import ImagePreview from "../../../components/ImagePreview";
import { truncateContent } from "../../../utils";
import ChatCodeBlock from "../ChatCodeBlock";
import { useMCPStore } from "../../../store/mcp";

const MCPToolCall = memo(function MCPToolCall(props: {
  message: ChatMessage;
  isLatest?: boolean;
}) {
  const { message, isLatest } = props;
  const isMCPProcessing = useChatStreamStore((state) => state.isMCPProcessing);
  const getChineseNameByServerName = useMCPStore((state) => state.getChineseNameByServerName);

  const toolCallParams: any = useMemo(() => {
    let params: any = {};
    if (message.tool_calls && message.tool_calls[0]) {
      const toolCall = message.tool_calls[0];
      try {
        params = JSON.parse(toolCall.function.arguments || '{}');
      } catch (err) {
        console.error('解析 ToolCall 参数失败', err);
        params = {};
      }
    }
    return params;
  }, [message.tool_calls]);

  const mcpParams = useMemo(() => {
    let params: any = {};
    try {
      params = JSON.parse(toolCallParams.arguments || '{}');
    } catch (err) {
      console.error('解析 MCP 参数失败', err);
      params = {};
    }
    return params;
  }, [toolCallParams]);

  const serverName = useMemo(() => {
    let name = toolCallParams.server_name || '';
    name = name.replace('\\', '/');
    name = name.split('/').slice(-1)[0];
    return name;
  }, [toolCallParams]);

  // 获取服务器显示名称（优先显示中文名）
  const serverDisplayName = useMemo(() => {
    const chineseName = getChineseNameByServerName(serverName);
    return chineseName || serverName;
  }, [serverName, getChineseNameByServerName]);

  // 生成稳定的 key，基于消息 id 和工具调用 id
  const stableCodeBlockKey = useMemo(() => {
    const toolCall = message.tool_calls?.[0];
    return `${message.id}-${toolCall?.id || 'default'}-result`;
  }, [message.id, message.tool_calls]);

  const stableParamsKey = useMemo(() => {
    const toolCall = message.tool_calls?.[0];
    return `${message.id}-${toolCall?.id || 'default'}-params`;
  }, [message.id, message.tool_calls]);

  const renderResult = useCallback((mcpContent: any) => {
    let content
    try {
      content = JSON.parse(mcpContent);
    } catch (e) {
      content = mcpContent
    }
    if (typeof content === 'string') {
      return <Box>
        <pre style={{ marginBottom: 0 }}>
          <ChatCodeBlock
            key={stableCodeBlockKey}
            language='result'
            value={truncateContent(content)}
            data={{
              defaultExpanded: false,
              message: message
            }}
          />
        </pre>
      </Box>
    } else if (Array.isArray(content)) {
      return <>
        {
          content.map((item, index) => {
            if (item.type === 'text') {
              return <Box key={`text-${index}`}>
                <pre style={{ marginBottom: 0 }}>
                  <ChatCodeBlock
                    key={`${stableCodeBlockKey}-${index}`}
                    language='result'
                    value={truncateContent(item.text)}
                    data={{
                      defaultExpanded: false,
                      message: message
                    }}
                  />
                </pre>
              </Box>
            } else if (item.type === 'image_url') {
              const imageUrl = item.image_url.url || '';
              return <Box key={`image-${index}`}>
                <ImagePreview w="144px" h="144px" url={imageUrl} />
              </Box>
            } else {
              return null
            }
          })
        }
      </>
    } else {
      return null;
    }
  }, [message, stableCodeBlockKey])

  if (message.tool_calls && message.tool_calls[0]) {
    const toolCall = message.tool_calls[0];
    const result = message.tool_result ? message.tool_result[toolCall.id] : undefined;
    const response = message.response ? message.response[toolCall.id] : undefined;
    const hasResult = result !== undefined;
    const hasResponse = response !== undefined;

    const MCPToolName = toolCallParams.tool_name;
    const MCPResourceUri = toolCallParams.uri;
    return (
      <Box flex="1">
        <Flex alignItems="center">
          {hasResponse && (
            <Icon
              w="16px"
              h="16px"
              mr={2}
              // mt="4px"
              as={
                response === false
                  ? RxCircleBackslash
                  : RxCheckCircled
              }
              color={response ? 'green' : 'gray'}
            />
          )}
          <Box
            flex="1"
            display='flex'
            textAlign="left"
            alignItems='center'
            color="text.primary"
          >

            {
              toolCall.function.name === 'use_mcp_tool'
                ? (
                  <>
                    Y3Maker 将使用 <Text as="span" fontWeight="500">【{serverDisplayName}】</Text> 工具中的方法： <Text as="span" ml={1} fontWeight="500"> <Icon as={TbCube} mr='4px' />{MCPToolName}</Text>
                  </>
                ) : (
                  <>
                    Y3Maker 需要获取 <Text as="span" fontWeight="500">【{serverDisplayName}】</Text> 的资源： <Text as="span" ml={1} fontWeight="500"> <Icon as={TbCube} mr='4px' />{MCPResourceUri}</Text>
                  </>
                )
            }
          </Box>

        </Flex>
        <Divider h="1px !important" my="8px !important" />
        {
          toolCall.function.name === 'use_mcp_tool' && (
            <Box marginTop={'10px'}>
              <Box my={1}>参数</Box>
              <Box>
                <pre style={{ marginBottom: 0 }}>
                  <ChatCodeBlock
                    key={stableParamsKey}
                    language='params'
                    value={JSON.stringify(mcpParams, null, 2)}
                    data={{
                      defaultExpanded: false,
                      message: message
                    }}
                  />
                </pre>
              </Box>
            </Box>
          )
        }
        {
          isMCPProcessing && !hasResult && isLatest && (
            <Spinner size="xs" />
          )
        }
        {
          hasResult && (
            <Box marginTop={'10px'} marginBottom={'10px'}>
              <Box my={1}>结果</Box>
              {renderResult(result.content)}
            </Box>
          )
        }
      </Box>
    )
  } else {
    return null;
  }
});

export default MCPToolCall;
