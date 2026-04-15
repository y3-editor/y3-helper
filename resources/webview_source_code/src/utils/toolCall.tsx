import { terminalCmdFunction } from "../routes/CodeChat/ChatMessagesList/TermialPanel";
import { RetrieveResult } from "../routes/CodeChat/RetrieveResultBlock";
import { ChatMessage, ToolCall, ToolResult } from "../services";
import { ChatModel } from "../services/chatModel";
import { ChatSession } from "../store/chat";
import { useChatConfig } from "../store/chat-config";
import { processMakePlanDenied, processMakePlanResult } from "../store/workspace/tools/plan";
import { processWriteTodoDenied, processWriteTodoResult } from "../store/workspace/tools/todo";
import { formatSkillContent, parseSkillToolResult } from "../store/skills";


export function getToolCallQuery(name: string, args: string) {
  let toolParams: any = {};
  if (args) {
    try {
      toolParams = JSON.parse(args);
    } catch {
      toolParams = {};
    }
  }
  switch (name) {
    case 'read_file':
      return '读取此文件内容';
    case 'list_files_top_level':
      return '读取此路径下的首层文件列表（不含代码内容）';
    case 'list_files_recursive':
      return '读取此路径下的全部文件列表（不含代码内容）';
    case 'view_source_code_definitions_top_level':
      return '读取此路径下文件的方法定义信息（仅类/变量/函数定义）';
    case 'retrieve_code':
      return '读取下列代码检索结果';
    case 'retrieve_knowledge':
      return '读取下列相关知识片段';
    case 'use_mcp_tool':
      return '调用MCP工具';
    case 'access_mcp_resource':
      return '获取MCP资源';
    case 'edit_file':
      return '编辑文件';
    case 'replace_in_file':
      return '修改文件';
    case 'reapply':
      return '重新修改';
    case 'run_terminal_cmd':
      return '执行终端命令';
    case 'make_plan':
      return '制定计划如下';
    case 'write_todo':
      return '写入待办事项';
    case 'generate_codewiki_structure':
      return 'Codewiki目录架构';
    case 'grep_search':
      return <div>使用 grep 搜索 <code>{toolParams.regex}</code></div>;
    case 'use_skill':
      return '使用Skill:';
    case 'ask_user_question':
      return '向用户提问';
    default:
      return '获取如下信息';
  }
}

export function getToolName(tool: ToolCall) {
  switch (tool.function.name) {
    case 'read_file':
      return '读取文件内容';
    case 'list_files_top_level':
      return '读取文件列表';
    case 'list_files_recursive':
      return '读取文件列表';
    case 'view_source_code_definitions_top_level':
      return '获取方法定义';
    case 'retrieve_code':
      return '检索代码地图';
    case 'retrieve_knowledge':
      return '检索知识库';
    case 'use_mcp_tool':
      return '调用MCP工具';
    case 'access_mcp_resource':
      return '获取MCP资源';
    case 'edit_file':
      return '编辑文件';
    case 'replace_in_file':
      return '编辑文件';
    case 'reapply':
      return '编辑文件';
    case 'run_terminal_cmd':
      return '执行终端命令';
    case 'make_plan':
      return '制定计划';
    case 'generate_codewiki_structure':
      return '生成Codewiki结构';
    case 'ask_user_question':
      return '向用户提问';
    default:
      return '执行工具';
  }
}

export function formatResultContent(options: {
  toolResponse: boolean;
  tool: ToolCall;
  result: ToolResult;
  unselectedResults?: Set<string>;
  session: ChatSession;
  userMessage?: ChatMessage;
  model: ChatModel;
}) {
  const {
    toolResponse,
    tool,
    result,
    unselectedResults,
    session,
    userMessage,
    model
  } = options;
  let resultContent = result.content;
  try {
    // 首先检查 toolResponse[tool.id] 是否为 false
    if (!toolResponse) {
      switch (tool.function.name) {
        case 'make_plan':
          resultContent = processMakePlanDenied();
          break;
        case 'write_todo':
          resultContent = processWriteTodoDenied();
          break;
        default:
          resultContent = 'The user denied this operation.';
      }
    } else if (tool.function.name === 'retrieve_code') {
      let tempResult = '';
      const searchData = JSON.parse(result.content) || [];
      console.log('searchData', searchData);


      let retrievedResults: RetrieveResult[] = [];

      searchData.forEach((item: any, index: number) => {
        item.path = item.path.split('/').slice(1).join('/');
        const filename = item.path
          ? item.path.replace(/\\/g, '/').split('/').slice(-1)[0]
          : '';
        const funcName = item.func_name
          ? item.func_name.split('\n').slice(-1)[0]
          : '';
        const language = filename
          ? filename.split('.').slice(-1)[0]
          : undefined;

        retrievedResults.push({
          id: funcName + index,
          name: funcName,
          content: item.code,
          link: filename,
          language: language,
          path: item.path,
          code: item.code,
          func_name: item.func_name,
          to_func: item.to_func,
          isLpc: item.isLpc,
          // annotation: item.annotation
        });
        if (item.to_func) {
          item.to_func.forEach((subItem: any) => {
            const subFilename = subItem.path
              ? subItem.path.replace(/\\/g, '/').split('/').slice(-1)[0]
              : '';
            const subFuncName = item.func_name
              ? item.func_name.split('\n').slice(-1)[0]
              : '';
            const subLanguage = subFilename
              ? subFilename.split('.').slice(-1)[0]
              : undefined;
            subItem.path = subItem.path
              .split('/')
              .slice(1)
              .join('/');
            retrievedResults.push({
              id: subFuncName + index,
              name: subFuncName,
              content: subItem.code,
              link: subFilename,
              language: subLanguage,
              path: subItem.path,
              code: subItem.code,
              isLpc: subItem.isLpc,
              // annotation: subItem.annotation
            });
          });
        }
      });
      console.log('retrievedResults', retrievedResults);
      console.log('unselectedResults', unselectedResults);


      //根据unselectedResults，过滤掉不需要的结果
      if (unselectedResults?.size && unselectedResults?.size > 0) {
        retrievedResults = retrievedResults.filter(
          (result) => !unselectedResults?.has(result.id),
        );
      }

      // 根据isLpc，过滤掉不需要的结果
      retrievedResults = retrievedResults.filter(
        (result) => !result.isLpc || !!useChatConfig.getState()?.chatModels?.[model]?.isPrivate,
      )

      let MAX_RESULT_LENGTH = 100000;
      if (model.includes('gemini')) {
        MAX_RESULT_LENGTH = 300000;
      } else if (model.includes('deepseek')) {
        MAX_RESULT_LENGTH = 50000;
      }
      retrievedResults.forEach((item: any, index: number) => {
        // TEMP: 临时使用字符串长度控制，避免超出 tokens 限制
        if (tempResult.length < MAX_RESULT_LENGTH) {
          tempResult += `[第${index + 1}个相关代码片段集合]\n`;
          tempResult += `文件路径：${item.path}\n`;
          tempResult += `代码：\n\`\`\`\n${item.code}\n\`\`\`\n`;
          if (item.to_func) {
            item.to_func.forEach((subItem: any) => {
              tempResult += `文件路径：${subItem.path}\n`;
              tempResult += `代码：\n\`\`\`\n${subItem.code}\n\`\`\`\n`;
            });
          }
        }
      });
      resultContent = tempResult;
      result.content = JSON.stringify(retrievedResults);
    } else if (tool.function.name === 'retrieve_knowledge') {
      let tempResult = '';
      const contextData = JSON.parse(result.content);
      let retrievedResults: RetrieveResult[] = [];
      contextData.forEach((item: any, index: number) => {
        retrievedResults.push({
          id: item.attributes.filename + index,
          name: item.attributes.filename,
          content: item.text,
          link: item.url,
          url: item.url,
          docset: item.docset,
          text: item.text,
          attributes: {
            filename: item.attributes.filename
          }
          // annotation: ''
        });
      });

      //根据unselectedResults，过滤掉不需要的结果
      if (unselectedResults?.size && unselectedResults?.size > 0) {
        retrievedResults = retrievedResults.filter(
          (result) => !unselectedResults?.has(result.id),
        );
      }

      retrievedResults.forEach((item: any, index: number) => {
        if (index !== 0) {
          tempResult += '\n\n\n';
        }
        tempResult += `## 资料片段 ${index + 1}\n\n### 文档名\n\n${item.attributes.filename}\n\n### URL\n\n${item.url}\n\n### 所属知识库\n\n${item.docset}\n\n### 片段内容\n\n${item.text}`;
      });
      resultContent = tempResult;
      result.content = JSON.stringify(retrievedResults);
    } else if (tool.function.name === terminalCmdFunction) {
      resultContent = toolResponse
        ? (result.extra?.terminalLog || resultContent)
        : 'The user denied this operation.';
    } else if (['edit_file', 'replace_in_file'].includes(tool.function.name)) {
      if (result.isError) {
        resultContent = `The file was not edited successfully. Error message: \n\n${result.content}`;
      } else {
        resultContent = fileEditWithoutUserChanges(
          result.path,
          result.content,
          !!result?.extra?.isLargeFile,
        )
      }
    } else {
      switch (tool.function.name) {
        case 'make_plan':
          resultContent = processMakePlanResult(tool, result, userMessage);
          break;
        case 'write_todo':
          resultContent = processWriteTodoResult(tool, result, session);
          break;
        case 'use_skill':
          resultContent = processUseSkillResult(result);
          break;
        default:
          resultContent = result.content;
      }
    }
  } catch (err) {
    console.error(err);
  }
  return resultContent;
}

function processUseSkillResult(result: ToolResult): string {
  const skillData = parseSkillToolResult(result.content);
  if (skillData) {
    // 上报模型调用 Skill 事件
    import('../services/skillUsage').then(({ reportSkillInvoke }) => {
      import('../store/skills').then(({ getSkillDescription }) => {
        const description = getSkillDescription(skillData.name);
        reportSkillInvoke(skillData.name, { source: 'codemaker-model', description });
      });
    });
    return formatSkillContent(skillData);
  }
  return result.content;
}

function fileEditWithoutUserChanges(
  filePath: string,
  finalResult: string,
  isLargeFile: boolean
) {
  if (isLargeFile) {
    return `The content has been updated at ${filePath}.\n` +
      `Diff of changes applied:\n` +
      `<file_diff path="${filePath}">${finalResult}</file_diff>\n` +
      `Each line in file_diff follows this format:\n` +
      `- "+ line_number:content" indicates ADDING content at the specified line number \n` +
      `- Lines without +/- prefixes represent unchanged context \n` +
      `Use this diff format to understand exactly what was added and removed.`
  }
  return `The content was successfully saved to ${filePath}.\n\n` +
    `Here is the full, updated content of the file that was saved:\n\n` +
    `<final_file_content path="${filePath}">\n${finalResult}\n</final_file_content>\n\n` +
    `IMPORTANT: For any future changes to this file, use the final_file_content shown above as your reference. This content reflects the current state of the file. Always base your edit_file or replace_in_file operations on this final version to ensure accuracy.\n\n`
}
