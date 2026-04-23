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
  const MCPServers = useMCPStore((state) => state.MCPServers);

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

  // 查找对应的 MCP 服务器配置
  const mcpServer = useMemo(() => {
    if (!serverName) return null;
    return MCPServers.find(s => {
      let serverName_ = s.name || '';
      serverName_ = serverName_.replace('\\', '/');
      serverName_ = serverName_.split('/').slice(-1)[0];
      return serverName_ === serverName;
    });
  }, [serverName, MCPServers]);

  // 获取服务器显示名称（优先显示中文名）
  const serverDisplayName = useMemo(() => {
    const chineseName = getChineseNameByServerName(serverName);
    return chineseName || serverName;
  }, [serverName, getChineseNameByServerName]);

  // 判断是否自动调用
  const isAutoApprove = useMemo(() => {
    return mcpServer?.config?.autoApprove || false;
  }, [mcpServer]);

  // 生成稳定的 key，基于消息 id 和工具调用 id
  const stableCodeBlockKey = useMemo(() => {
    const toolCall = message.tool_calls?.[0];
    return `${message.id}-${toolCall?.id || 'default'}-result`;
  }, [message.id, message.tool_calls]);

  const stableParamsKey = useMemo(() => {
    const toolCall = message.tool_calls?.[0];
    return `${message.id}-${toolCall?.id || 'default'}-params`;
  }, [message.id, message.tool_calls]);

  const renderResult = useCallback((mcpContent: any, shouldExpand: boolean, dynamicKey: string) => {
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
            key={dynamicKey}
            language='result'
            value={truncateContent(content)}
            data={{
              defaultExpanded: shouldExpand,
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
                    key={`${dynamicKey}-${index}`}
                    language='result'
                    value={truncateContent(item.text)}
                    data={{
                      defaultExpanded: shouldExpand,
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
  }, [message])

  if (message.tool_calls && message.tool_calls[0]) {
    const toolCall = message.tool_calls[0];
    const result = message.tool_result ? message.tool_result[toolCall.id] : undefined;
    const response = message.response ? message.response[toolCall.id] : undefined;
    const hasResult = result !== undefined;
    const hasResponse = response !== undefined;

    // 需要用户确认的状态：没有自动授权 且 没有response（用户还未确认）
    const needsUserConfirmation = !isAutoApprove && !hasResponse && isLatest;

    // 判断参数是否应该展开：需要用户确认时就展开（让用户查看参数来决定是否授权）
    const shouldExpandParams = needsUserConfirmation;

    // 判断结果是否应该展开：结果始终不展开
    const shouldExpandResult = false;

    // 动态生成 key，包含展开状态，确保状态变化时组件重新渲染
    const dynamicParamsKey = `${stableParamsKey}-${shouldExpandParams}`;
    const dynamicResultKey = `${stableCodeBlockKey}-${shouldExpandResult}`;

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
                    CodeMaker 将使用 <Text as="span" fontWeight="500">【{serverDisplayName}】</Text> 工具中的方法： <Text as="span" ml={1} fontWeight="500"> <Icon as={TbCube} mr='4px' />{MCPToolName}</Text>
                  </>
                ) : (
                  <>
                    CodeMaker 需要获取 <Text as="span" fontWeight="500">【{serverDisplayName}】</Text> 的资源： <Text as="span" ml={1} fontWeight="500"> <Icon as={TbCube} mr='4px' />{MCPResourceUri}</Text>
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
                    key={dynamicParamsKey}
                    language='params'
                    value={JSON.stringify(mcpParams, null, 2)}
                    data={{
                      defaultExpanded: shouldExpandParams,
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
              {renderResult(result.content, shouldExpandResult, dynamicResultKey)}
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