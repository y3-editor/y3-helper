import {
  Accordion,
  AccordionButton,
  AccordionItem,
  Box,
  Flex,
  Icon,
  VStack,
  Text,
  AccordionIcon,
  AccordionPanel,
  Tooltip,
} from '@chakra-ui/react';
import RetrieveResultBlock, { RetrieveResult } from '../RetrieveResultBlock';
import { ToolCallResultsProps } from './types';
import { EditFile } from './EditFile';
import { ClaudeEditFile } from './ClaudeEditFile';
import { useCallback, useMemo, useState } from 'react';
import { RxCheckCircled, RxCircleBackslash } from 'react-icons/rx';
import { getToolName } from '../../../utils/toolCall';
import { parseSkillToolResults } from '../../../services/harness/tools/use_skill';
import { getSkillSourceLabel } from '../../../store/skills';
import MemoCodeBlock from '../../../components/Markdown/CodeBlock';
import { usePostMessage } from '../../../PostMessageProvider';
import MCPToolCall from './MCPToolCall';
import { ToolCall } from '../../../services';
import TerminalPanel, { terminalCmdFunction } from './TermialPanel';
import Markdown from '../../../components/Markdown';
import {
  getStringContent,
  isImageFileByPath,
  truncateContent,
} from '../../../utils';
import CollapsibleMessage from '../../../components/CollapsibleMessage';
import SubagentTaskCard from './ToolCallCard/Task';
import TodoList from '../../../components/TodoList';
import {
  TodoList as TodoListType,
  getToolParams as getTodoToolParams,
} from './../../../services/harness/tools/todo';
import {
  generatePlanText,
  getToolParams as getPlanToolParams,
} from './../../../services/harness/tools/plan';
import AskUserQuestion from './AskUserQuestion';
import { getToolParams as getAskUserQuestionToolParams } from './../../../services/harness/tools/askUserQuestion';
import { parseGlobSearchParams } from './../../../services/harness/tools/search/glob';

// 提取文件名的工具函数
const getFileName = (filePath: string): string => {
  if (!filePath) return '';
  // 处理 Windows 和 Unix 路径分隔符
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  return parts[parts.length - 1];
};

// 处理检索代码结果的数据转换
const parseRetrievedCodeResults = (content: string): RetrieveResult[] => {
  try {
    const results: RetrieveResult[] = [];
    const searchResult = JSON.parse(content);

    searchResult.forEach((item: any, index: number) => {
      // 处理主结果
      const path = item.path ? item.path.split('/').slice(1).join('/') : '';
      const filename = path
        ? path.replace(/\\/g, '/').split('/').slice(-1)[0]
        : '';
      const funcName = item.func_name
        ? item.func_name.split('\n').slice(-1)[0]
        : '';
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
          const subPath = subItem.path
            ? subItem.path.split('/').slice(1).join('/')
            : '';
          const subFilename = subPath
            ? subPath.replace(/\\/g, '/').split('/').slice(-1)[0]
            : '';
          const subLanguage = subFilename
            ? subFilename.split('.').slice(-1)[0]
            : undefined;

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
  isLatest,
}: ToolCallResultProps) => {
  const isRetrievedCode = tool.function.name === 'retrieve_code';
  const isRetrievedKnowledge = tool.function.name === 'retrieve_knowledge';
  const isEditFileTool = ['edit_file', 'replace_in_file', 'reapply'].includes(
    tool.function.name,
  );
  const isClaudeEditFileTool = ['write', 'edit'].includes(tool.function.name);
  const isMCPTool =
    tool.function.name === 'use_mcp_tool' ||
    tool.function.name === 'access_mcp_resource';
  const isAskUserQuestionTool = tool.function.name === 'ask_user_question';
  const isReadFileTool = ['read_file'].includes(tool.function.name);
  const isListFilesTool = [
    'list_files_top_level',
    'list_files_recursive',
  ].includes(tool.function.name);
  const isPlan = tool.function.name === 'make_plan';
  const isSkillTool = tool.function.name === 'use_skill';
  const isGlobSearchTool = tool.function.name === 'glob_search';

  const isTaskTool = tool.function.name === 'task';

  // 检查当前 tool 是否为 terminal 工具(而不是检查整个 message)
  const isTerminalTool = tool.function.name === terminalCmdFunction;

  const { postMessage } = usePostMessage();

  // MCP 工具和 Terminal 工具在等待时展开，plan 工具始终展开，其他工具都收起
  const initialIndex =
    !toolResponseDisabled && (isMCPTool || isTerminalTool || isPlan)
      ? 0
      : undefined;
  const [accordionIndex, setAccordionIndex] = useState<number | undefined>(
    initialIndex,
  );

  const collapseDisabled = useMemo(() => {
    return isReadFileTool && isImageFileByPath(result.path);
  }, [isReadFileTool, result.path]);

  const locateFile = useCallback(
    (filePath: string, startLine?: number, endLine?: number) => {
      const data = { filePath, startLine, endLine };
      if (!startLine || !endLine) {
        delete data.startLine;
        delete data.endLine;
      }
      postMessage({
        type: 'OPEN_FILE',
        data: data,
      });
    },
    [postMessage],
  );

  const displayContent = useMemo(() => {
    if (isSkillTool && result.content) {
      const skillDataList = parseSkillToolResults(result.content);
      if (skillDataList.length) {
        const display = skillDataList.map((skillData) => {
          let content = skillData.content;
          if (skillData.resources?.files?.length) {
            content += `\n\n## Resources (${skillData.resources.files.length} files)\n`;
            content += skillData.resources.files.slice(0, 10).join('\n');
            if (skillData.resources.files.length > 10) {
              content += `\n... and ${skillData.resources.files.length - 10} more`;
            }
          }
          return content;
        }).join('\n\n---\n\n');

        return truncateContent(display);
      }
    }
    return truncateContent(result.content);
  }, [result.content, isSkillTool]);

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
  }, [isPlan, tool.function.arguments]);

  const renderError = () => {
    return (
      <Box px={2} py={1}>
        <CollapsibleMessage
          title={`${getToolName(tool)}遇到问题`}
          titleColor="text.default"
          opacity={0.7}
          useQuote
        >
          <Box color="text.default">{getStringContent(result.content)}</Box>
        </CollapsibleMessage>
      </Box>
    );
  };

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
  }, [tool.function.arguments, result.content]);

  if (isPlan) {
    return (
      <Accordion
        allowToggle
        index={accordionIndex}
        onChange={(index) => setAccordionIndex(index as number | undefined)}
      >
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
                <Markdown data={null}>{planContent}</Markdown>
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
        options={
          Array.isArray(askUserQuestionParams.options)
            ? askUserQuestionParams.options
            : []
        }
        multiSelect={askUserQuestionParams.multiSelect}
        isSubmitted={isSubmitted}
        submittedResult={submittedResult}
      />
    );
  }

  // 渲染 Claude write/edit 工具结果
  if (isClaudeEditFileTool) {
    return (
      <VStack gap={1} align="stretch">
        <ClaudeEditFile
          toolName={tool.function.name as 'write' | 'edit'}
          messageId={message.id}
          toolCallId={tool.id}
          filePath={result.path || toolParams.file_path || ''}
          toolArgs={tool?.function?.arguments || ''}
          isLatest={isLatest}
          hasResponse={toolResponse[tool.id] !== undefined}
        />
        {result.isError && renderError()}
      </VStack>
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
          updateSnippet={(toolParams.code_edit as string) || ''}
          replaceSnippet={(toolParams.diff as string) || ''}
          isCreateFile={(toolParams.is_create_file as boolean) || false}
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

  // 渲染 Terminal 工具(只渲染当前 tool 对应的 Terminal)
  if (isTerminalTool) {
    // 从 result 中获取 terminal 相关数据
    const terminalLog = result.content || '';
    const terminalStatus = result.extra?.terminalStatus || '';
    const hasShellIntegration = result.extra?.hasShellIntegration || false;
    const isRtk = !!result.extra?.isRtk;

    // 解析 terminal 配置
    let terminalConfig = {
      command: '',
      is_background: false,
      require_user_approval: false,
    };
    try {
      const data = JSON.parse(tool.function.arguments || '{}');
      terminalConfig = {
        command: data.command || '',
        is_background: data.is_background || false,
        require_user_approval: data.require_user_approval || false,
      };
    } catch (error) {
      console.error('Failed to parse terminal config:', error);
    }

    return (
      <VStack gap={1} align="stretch">
        <TerminalPanel
          messageId={message.id}
          terminalId={tool.id}
          config={terminalConfig}
          log={terminalLog}
          status={terminalStatus}
          hasShellIntegration={hasShellIntegration}
          isRtk={isRtk}
        />
      </VStack>
    );
  }

  // 渲染子代理任务工具
  if (isTaskTool) {
    return (
      <SubagentTaskCard
        tool={tool}
        toolParams={toolParams}
        result={result}
        toolResponseDisabled={toolResponseDisabled}
      />
    );
  }

  // 工具结果标题
  const renderResultTitle = () => {
    if (isSkillTool) {
      const skillDataList = parseSkillToolResults(result.content || '');
      const skillName = skillDataList.length
        ? skillDataList.map((skillData) => skillData.name).join(', ')
        : result.path || '';
      const sourcePathList = Array.from(
        new Set(skillDataList.map((skillData) => getSkillSourceLabel(skillData.source))),
      ).filter(Boolean);
      const sourcePath = sourcePathList.join(', ');

      return (
        <Flex
          flex="1"
          justifyContent="space-between"
          alignItems="center"
          gap={2}
        >
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

    if (isGlobSearchTool) {
      const globParams = parseGlobSearchParams(tool);
      return (
        <Flex flex="1" alignItems="center" gap={1} minHeight="16px">
          Glob / <Box color={'#999'}>pattern={globParams.pattern}</Box> <Box color={'#888'} style={{ zoom: .8 }}>匹配 {result?.extra?.total || 0} 个文件</Box>
        </Flex>
      );
    }

    if (isReadFileTool) {
      const fileName = getFileName(result.path);
      const extra = result?.extra;
      const startLine = extra?.startLine || 0;
      const endLine = extra?.endLine || 0;
      const showLine = !!extra?.showLine;

      return (
        <Tooltip label={result.path} hasArrow placement="top">
          <Box
            maxWidth="100%"
            whiteSpace="nowrap"
            display="flex"
            alignItems="center"
            gap={1}
            minHeight="16px"
          >
            <Text as="span" color="text.secondary" mr={1} flexShrink={0}>
              {isImageFileByPath(result.path) ? '读取此图片' : '读取此文件内容'}
            </Text>
            <Box
              color="blue.300"
              cursor="pointer"
              className="truncate text-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                locateFile(
                  result.path,
                  result?.extra?.startLine,
                  result?.extra?.endLine,
                );
              }}
            >
              {fileName}
            </Box>
            <Box
              color="blue.300"
              fontSize={'10px'}
              fontWeight={'bold'}
              hidden={!startLine || !endLine || !showLine}
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                locateFile(
                  result.path,
                  result?.extra?.startLine,
                  result?.extra?.endLine,
                );
              }}
            >
              引用行数: {startLine}:{endLine}
            </Box>
          </Box>
        </Tooltip>
      );
    }

    const isCloudResult =
      result.path === '云端代码库检索结果' ||
      result.path === '云端知识库检索结果';
    const displayPath =
      isCloudResult && toolResponseDisabled
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
          {isListFilesTool && (
            <Text as="span" color="text.secondary" mr={1}>
              读取路径（不含代码内容）：
            </Text>
          )}
          {isReadFileTool && (
            <Text as="span" color="text.secondary" mr={1}>
              读取此文件内容：
            </Text>
          )}
          {displayPath}
          {(isRetrievedCode || isRetrievedKnowledge) &&
            retrievedResults.length > 0 && (
              <Text
                ml={1}
                style={{ display: 'inline', fontSize: '12px' }}
                color="#776fff"
              >
                {toolResponseDisabled
                  ? toolResponse[tool.id] === false
                    ? '(共发送0条结果)'
                    : `(共发送${retrievedResults.length}条结果)`
                  : `(共返回${retrievedResults.length}条结果)`}
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
      const isRejected =
        toolResponseDisabled && toolResponse[tool.id] === false;

      return retrievedResults.map((item, index) => (
        <RetrieveResultBlock
          data={item}
          index={index}
          key={index}
          toolResponseDisabled={toolResponseDisabled && !isRejected}
          isSelected={isRejected ? false : !unselectedResults.has(item.id)}
          onSelectionChange={(isSelected) =>
            handleSelectionChange(item.id, isSelected, tool.id)
          }
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
      {!result.isError && (
        <Accordion
          allowToggle
          index={accordionIndex}
          onChange={(index) => setAccordionIndex(index as number | undefined)}
        >
          <AccordionItem
            borderLeftWidth={toolResponseDisabled ? '1px' : undefined}
            borderRightWidth={toolResponseDisabled ? '1px' : undefined}
            borderRadius={toolResponseDisabled ? '4px' : undefined}
          >
            <AccordionButton flex={1}>
              {toolResponseDisabled && (
                <Icon
                  w="14px"
                  h="14px"
                  mr={1.5}
                  as={
                    toolResponse[tool.id] === false
                      ? RxCircleBackslash
                      : RxCheckCircled
                  }
                  color={toolResponse[tool.id] ? 'green' : 'gray'}
                />
              )}
              <Box
                as="span"
                flex="1"
                textAlign="left"
                color="text.primary"
                overflow="hidden"
                minWidth="0"
              >
                {renderResultTitle()}
              </Box>
              {!collapseDisabled && <AccordionIcon />}
            </AccordionButton>
            {!collapseDisabled && (
              <AccordionPanel>{renderContent()}</AccordionPanel>
            )}
          </AccordionItem>
        </Accordion>
      )}
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
    isLatest,
  } = props;

  const toolCallResults = message.tool_result || {};

  // 如果没有工具调用,返回null
  if (!message.tool_calls?.length) {
    return null;
  }

  return (
    <>
      {message.tool_calls.map((tool, index) => {
        const result = toolCallResults[tool.id] || {};
        const isTaskTool = tool.function.name === 'task';
        const isMakePlanTool = tool.function.name === 'make_plan';
        const isAskUserQuestionTool =
          tool.function.name === 'ask_user_question';
        const isRunTerminalTool = tool.function.name === terminalCmdFunction;
        const isMCPTool =
          tool.function.name === 'use_mcp_tool' ||
          tool.function.name === 'access_mcp_resource';
        const editFileTool = ['write', 'edit', 'edit_file', 'replace_in_file'].includes(tool.function.name);

        // task, ask_user_question, run_terminal_cmd, make_plan, MCP工具总是显示(用于展示实时执行状态和等待用户交互)
        // 其他工具只有在有结果时才显示(避免空白卡片)
        if (
          !isTaskTool &&
          !isAskUserQuestionTool &&
          !isRunTerminalTool &&
          !isMakePlanTool &&
          !isMCPTool &&
          !toolCallResults[tool.id] &&
          !editFileTool
        ) {
          return null;
        }

        return (
          <ToolCallResult
            key={`${tool.id}-${index}`}
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