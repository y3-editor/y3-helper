import { Accordion, AccordionButton, AccordionItem, Box, Flex, Icon, VStack, Text, AccordionIcon, AccordionPanel, Tooltip } from "@chakra-ui/react";
import RetrieveResultBlock, { RetrieveResult } from "../RetrieveResultBlock";
import { ToolCallResultsProps } from "./types";
import { EditFile } from "./EditFile";
import { useCallback, useMemo } from "react";
import { RxCheckCircled, RxCircleBackslash } from "react-icons/rx";
import { getToolName } from "../../../utils/toolCall";
import { getSkillSourceLabel, parseSkillToolResult } from "../../../store/skills";
import MemoCodeBlock from "../../../components/Markdown/CodeBlock";
import { usePostMessage } from "../../../PostMessageProvider";
import MCPToolCall from "./MCPToolCall";
import { ToolCall } from "../../../services";
import { useChatTerminal } from "./TermialPanel";
import Markdown from "../../../components/Markdown";
import { getStringContent, truncateContent } from "../../../utils";
import CollapsibleMessage from "../../../components/CollapsibleMessage";

// 提取文件名的工具函数
const getFileName = (filePath: string): string => {
  if (!filePath) return '';
  // 处理 Windows 和 Unix 路径分隔符
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  return parts[parts.length - 1];
};
import TodoList from "../../../components/TodoList";
import { TodoList as TodoListType, getToolParams as getTodoToolParams } from "../../../store/workspace/tools/todo";
import { generatePlanText, getToolParams as getPlanToolParams } from "../../../store/workspace/tools/plan";
import PreviewCodewikiStructure from "./PreviewCodewikiStructure";
import AskUserQuestion from "./AskUserQuestion";
import { getToolParams as getAskUserQuestionToolParams } from "../../../store/workspace/tools/askUserQuestion";

// 处理检索代码结果的数据转换
const parseRetrievedCodeResults = (content: string): RetrieveResult[] => {
  try {
    const results: RetrieveResult[] = [];
    const searchResult = JSON.parse(content);

    searchResult.forEach((item: any, index: number) => {
      // 处理主结果
      const path = item.path ? item.path.split('/').slice(1).join('/') : '';
      const filename = path ? path.replace(/\\/g, '/').split('/').slice(-1)[0] : '';
      const funcName = item.func_name ? item.func_name.split('\n').slice(-1)[0] : '';
      const name = item.name ? item.name.split('\n').slice(-1)[0] : '';
      const func = item.func ? item.func.split('\n').slice(-1)[0] : '';
      const language = filename ? filename.split('.').slice(-1)[0] : undefined;

      results.push({
        id: funcName + index,
        name: funcName || name || func,
        content: item.code,
        link: filename,
        language,
        linkTooltip: path,
        isLpc: item.isLpc,
      });

      // 处理关联结果
      if (item.to_func) {
        item.to_func.forEach((subItem: any) => {
          const subPath = subItem.path ? subItem.path.split('/').slice(1).join('/') : '';
          const subFilename = subPath ? subPath.replace(/\\/g, '/').split('/').slice(-1)[0] : '';
          const subLanguage = subFilename ? subFilename.split('.').slice(-1)[0] : undefined;

          results.push({
            id: funcName + index + subFilename,
            name: funcName,
            content: subItem.code,
            link: subFilename,
            language: subLanguage,
            linkTooltip: subPath,
            isLpc: subItem.isLpc,
          });
        });
      }
    });

    return results;
  } catch (e) {
    console.warn('Failed to parse retrieved code results:', e);
    return [];
  }
};

// 处理检索知识结果的数据转换
const parseRetrievedKnowledgeResults = (content: string): RetrieveResult[] => {
  try {
    const results: RetrieveResult[] = [];
    const searchResult = JSON.parse(content);

    searchResult.forEach((item: any, index: number) => {
      results.push({
        id: item.attributes.filename + index,
        name: item.attributes.filename,
        content: item.text,
        link: item.url,
      });
    });

    return results;
  } catch (e) {
    console.warn('Failed to parse retrieved knowledge results:', e);
    return [];
  }
};

interface ToolCallResultProps extends ToolCallResultsProps {
  tool: ToolCall;
  result: any;
}

// 工具调用结果组件
const ToolCallResult = ({
  tool,
  result,
  toolResponse,
  toolResponseDisabled,
  unselectedResults,
  handleSelectionChange,
  message,
  isLatest
}: ToolCallResultProps) => {
  const isRetrievedCode = tool.function.name === 'retrieve_code';
  const isRetrievedKnowledge = tool.function.name === 'retrieve_knowledge';
  const isEditFileTool = ['edit_file', 'replace_in_file', 'reapply'].includes(tool.function.name);
  const isMCPTool = tool.function.name === 'use_mcp_tool' || tool.function.name === 'access_mcp_resource';
  const isAskUserQuestionTool = tool.function.name === 'ask_user_question';
  const isReadFileTool = ['read_file'].includes(tool.function.name);
  const isPlan = tool.function.name === 'make_plan';
  const isPreviewCodewikiStructure = tool.function.name === 'generate_codewiki_structure';
  const isSkillTool = tool.function.name === 'use_skill';

  const { postMessage } = usePostMessage();

  const locateFile = useCallback((filePath: string, startLine?: number, endLine?: number) => {
    const data = { filePath, startLine, endLine }
    if (!startLine || !endLine) {
      delete data.startLine
      delete data.endLine
    }
    postMessage({
      type: 'OPEN_FILE',
      data: data,
    });
  }, [postMessage]);

  const { hasTerminalTool, ChatTerminalPanel } = useChatTerminal(message);

  const displayContent = useMemo(() => {
    if (isSkillTool && result.content) {
      try {
        const skillData = JSON.parse(result.content);
        let display = skillData.content;
        if (skillData.resources?.files?.length) {
          display += `\n\n## Resources (${skillData.resources.files.length} files)\n`;
          display += skillData.resources.files.slice(0, 10).join('\n');
          if (skillData.resources.files.length > 10) {
            display += `\n... and ${skillData.resources.files.length - 10} more`;
          }
        }
        return truncateContent(display);
      } catch {
        // fallback
      }
    }
    return truncateContent(result.content)
  }, [result.content, isSkillTool])

  // 解析工具参数
  const toolParams = useMemo(() => {
    if (!tool.function.arguments) return {};
    try {
      return JSON.parse(tool.function.arguments);
    } catch {
      return {};
    }
  }, [tool.function.arguments]);


  // 处理检索结果
  const retrievedResults = useMemo(() => {
    if (isRetrievedCode) {
      return parseRetrievedCodeResults(result.content || '[]');
    }
    if (isRetrievedKnowledge) {
      return parseRetrievedKnowledgeResults(result.content || '[]');
    }
    return [];
  }, [isRetrievedCode, isRetrievedKnowledge, result.content]);

  const planContent = useMemo(() => {
    let content = '';
    if (isPlan) {
      try {
        const toolParams = getPlanToolParams(tool);

        const hasStructuredData = toolParams.title || toolParams.tasks;
        if (hasStructuredData) {
          const planText = generatePlanText(toolParams);
          content = planText;
        }
      } catch {
        content = '';
      }
    }
    return content;
  }, [isPlan, tool])


  const renderError = () => {
    return (
      <Box px={2} py={1}>
        <CollapsibleMessage title={`${getToolName(tool)}遇到问题`} titleColor="text.default" opacity={0.7} useQuote>
          <Box color="text.default">
            {getStringContent(result.content)}
          </Box>
        </CollapsibleMessage>
      </Box>
    )
  }

  const todoList = useMemo((): TodoListType['todos'] => {
    if (tool.function.name === 'write_todo' && result.content) {
      try {
        const toolParams = getTodoToolParams(tool);
        return Array.isArray(toolParams.todos) ? toolParams.todos : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [tool, result.content]);

  if (isPreviewCodewikiStructure) {
    return (
      <PreviewCodewikiStructure
        hasError={result?.isError}
        content={result.content}
        isLatest={isLatest}
      />
    )
  }

  if (isPlan) {
    return (
      <Accordion allowToggle defaultIndex={[0]}>
        <AccordionItem>
          <AccordionButton>
            <Box as="span" flex="1" textAlign="left" color="text.primary">
              制定计划如下
            </Box>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel>
            <VStack gap={1} align="stretch">
              <div className="markdown-body">
                <Markdown data={null}>
                  {planContent}
                </Markdown>
              </div>
            </VStack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
  }

  if (tool.function.name === 'write_todo') {
    return (
      <Box px={2} py={1}>
        <TodoList todos={todoList} showCheckbox />
      </Box>
    );
  }

  // 渲染 ask_user_question 工具结果
  if (isAskUserQuestionTool) {
    const askUserQuestionParams = getAskUserQuestionToolParams(tool);
    const isSubmitted = toolResponse[tool.id] !== undefined;
    const submittedResult = result.content || '';

    return (
      <AskUserQuestion
        toolCallId={tool.id}
        messageId={message.id}
        question={askUserQuestionParams.question}
        options={Array.isArray(askUserQuestionParams.options) ? askUserQuestionParams.options : []}
        multiSelect={askUserQuestionParams.multiSelect}
        isSubmitted={isSubmitted}
        submittedResult={submittedResult}
      />
    );
  }

  // 渲染编辑文件工具结果
  if (isEditFileTool) {
    return (
      <VStack gap={1} align="stretch">
        <EditFile
          messageId={message.id}
          toolCallId={tool.id}
          hasResponse={toolResponse[tool.id] !== undefined}
          filePath={result.path || toolParams.target_file}
          updateSnippet={toolParams.code_edit as string || ''}
          replaceSnippet={toolParams.diff as string || ''}
          isCreateFile={toolParams.is_create_file as boolean || false}
          isLatest={isLatest}
          type={toolParams.diff ? 'replace' : 'edit'}
        />
        {result.isError && renderError()}
      </VStack>
    );
  }

  // 渲染MCP工具调用结果
  if (isMCPTool) {
    return (
      <VStack gap={0} align="stretch">
        <Box px={2} py={1}>
          <MCPToolCall message={message} isLatest={isLatest} />
        </Box>
        {result.isError && renderError()}
      </VStack>
    );
  }

  if (hasTerminalTool) {
    return (
      <VStack gap={1} align="stretch">
        {ChatTerminalPanel}
      </VStack>
    )
  }

  // 工具结果标题
  const renderResultTitle = () => {
    if (isSkillTool) {
      const skillName = result.path || '';
      const skillData = parseSkillToolResult(result.content);
      const sourcePath = skillData ? getSkillSourceLabel(skillData.source) : '';

      return (
        <Flex flex="1" justifyContent="space-between" alignItems="center" gap={2}>
          <Box as="span" color="text.primary" className="truncate">
            {skillName}
          </Box>
          {sourcePath && (
            <Box as="span" fontSize="12px" color="blue.500" flexShrink={0}>
              {sourcePath}
            </Box>
          )}
        </Flex>
      );
    }

    if (isReadFileTool) {
      const fileName = getFileName(result.path);
      const extra = result?.extra
      const startLine = extra?.startLine || 0;
      const endLine = extra?.endLine || 0;
      const showLine = !!extra?.showLine;
      return (
        <Tooltip label={result.path} hasArrow placement="top">
          <Box
            color="blue.300"
            cursor="pointer"
            maxWidth="100%"
            whiteSpace="nowrap"
            display="flex"
            alignItems="center"
            gap={1}
            minHeight="16px"
          >
            <Box
              className="truncate text-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                locateFile(result.path, result?.extra?.startLine, result?.extra?.endLine);
              }}
            >
              {fileName}
            </Box>
            <Box
              fontSize={'10px'}
              fontWeight={'bold'}
              hidden={!startLine || !endLine || !showLine}
              onClick={(e) => {
                e.stopPropagation();
                locateFile(result.path, result?.extra?.startLine, result?.extra?.endLine);
              }}
            >
              引用行数: {startLine}:{endLine}
            </Box>
          </Box>
        </Tooltip>
      );
    }

    const isCloudResult = result.path === '云端代码库检索结果' || result.path === '云端知识库检索结果';
    const displayPath = isCloudResult && toolResponseDisabled
      ? result.path.replace('检索结果', '发送内容')
      : result.path;

    return (
      <Box
        as="span"
        flex="1"
        textAlign="left"
        color="text.primary"
        display="flex"
        alignItems="center"
        minHeight="16px"
      >
        <Box>
          {displayPath}
          {(isRetrievedCode || isRetrievedKnowledge) && retrievedResults.length > 0 && (
            <Text ml={1} style={{ display: 'inline', fontSize: '12px' }} color="#776fff">
              {toolResponseDisabled
                ? toolResponse[tool.id] === false
                  ? '(共发送0条结果)'
                  : `(共发送${retrievedResults.length}条结果)`
                : `(共返回${retrievedResults.length}条结果)`
              }
            </Text>
          )}
        </Box>
      </Box>
    );
  };


  // 渲染内容
  const renderContent = () => {
    if ((isRetrievedCode || isRetrievedKnowledge) && retrievedResults.length) {
      // 判断用户是否拒绝了这个工具
      const isRejected = toolResponseDisabled && toolResponse[tool.id] === false;

      return retrievedResults.map((item, index) => (
        <RetrieveResultBlock
          data={item}
          index={index}
          key={index}
          toolResponseDisabled={toolResponseDisabled && !isRejected}
          isSelected={isRejected ? false : !unselectedResults.has(item.id)}
          onSelectionChange={(isSelected) => handleSelectionChange(item.id, isSelected, tool.id)}
          toolId={tool.id}
        />
      ));
    }

    return (
      <div className="markdown-body">
        <pre>
          <MemoCodeBlock
            maxHeight={500}
            hiddenLineNumber={!!result?.extra?.showLine}
            language="plaintext"
            value={displayContent}
          />
        </pre>
      </div>
    );
  };

  return (
    <VStack gap={1} align="stretch">
      {/* 工具调用结果内容 */}
      {
        !result.isError && (
          <Accordion allowToggle defaultIndex={result.isError ? 0 : undefined}>
            <AccordionItem borderLeftWidth={toolResponseDisabled ? '1px' : undefined}
              borderRightWidth={toolResponseDisabled ? '1px' : undefined}
              borderRadius={toolResponseDisabled ? '4px' : undefined}>
              <AccordionButton>
                {toolResponseDisabled && (
                  <Icon
                    w="14px"
                    h="14px"
                    mr={1.5}
                    as={toolResponse[tool.id] === false ? RxCircleBackslash : RxCheckCircled}
                    color={toolResponse[tool.id] ? 'green' : 'gray'}
                  />
                )}
                <Box as="span" flex="1" textAlign="left" color="text.primary" overflow="hidden" minWidth="0">
                  {renderResultTitle()}
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel>
                {renderContent()}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )
      }
      {result.isError && renderError()}
    </VStack>
  );
};

export default function ToolCallResults(props: ToolCallResultsProps) {
  const {
    message,
    toolResponseDisabled,
    toolResponse,
    unselectedResults,
    handleSelectionChange,
    isLatest
  } = props;

  // 如果没有工具调用或者消息正在处理中，返回null
  if (!message.tool_calls?.length || message.processing) {
    return null;
  }

  const toolCallResults = message.tool_result || {};

  return (
    <>
      {message.tool_calls.map((tool) => {
        const result = toolCallResults[tool.id] || {};
        return (
          <ToolCallResult
            key={tool.id}
            tool={tool}
            result={result}
            toolResponse={toolResponse}
            toolResponseDisabled={toolResponseDisabled}
            unselectedResults={unselectedResults}
            handleSelectionChange={handleSelectionChange}
            message={message}
            isLatest={isLatest}
          />
        );
      })}
    </>
  );
}
