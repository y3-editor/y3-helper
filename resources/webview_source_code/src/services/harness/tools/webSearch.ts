// refer: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

import { SubscribeActions } from "../../../PostMessageProvider";
import { useChatStreamStore } from "../../../store/chat";
import { ChatRole } from "../../../types/chat";
import { getErrorMessage } from "../../../utils";
import AigwCodebase from "../stream/aigwCodebase";

export const TOOL_NAME = 'web_search';

export const getWebSearchTool = () => {

  const currentMonthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const description = `
- Allows Codemaker to search the web and use the results to inform responses
- Provides up-to-date information for current events and recent data
- Returns search result information formatted as search result blocks, including links as markdown hyperlinks
- Use this tool for accessing information beyond Claude's knowledge cutoff
- Searches are performed automatically within a single API call

CRITICAL REQUIREMENT - You MUST follow this:
  - After answering the user's question, you MUST include a "Sources:" section at the end of your response
  - In the Sources section, list all relevant URLs from the search results as markdown hyperlinks: [Title](URL)
  - This is MANDATORY - never skip including sources in your response
  - Example format:

    [Your answer here]

    Sources:
    - [Source Title 1](https://example.com/1)
    - [Source Title 2](https://example.com/2)

Usage notes:
  - Domain filtering is supported to include or block specific websites
  - Web search is only available in the world

IMPORTANT - Use the correct year in search queries:
  - The current month is ${currentMonthYear}. You MUST use this year when searching for recent information, documentation, or current events.
  - Example: If the user asks for "latest React docs", search for "React documentation" with the current year, NOT last year
`

  return {
    type: 'function',
    function: {
      name: TOOL_NAME,
      description: description,
      parameters: {
        type: 'object',
        properties: {
          "query": {
            "type": "string",
            "minLength": 2,
            "description": "The search query to use"
          },
          "allowed_domains": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Only include search results from these domains"
          },
          "blocked_domains": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Never include search results from these domains"
          }
        },
        required: ['query'],
      }
    },
  }
}

// 请求控制器
export let webSearchController = new AbortController()

/**
 * 处理搜索结果
 */
export const handleWebSearchResult = (
  toolId: string,
  toolName: string,
  toolParams: {
    query: string,
    allowed_domains?: string[],
    blocked_domains?: string[],
  }
) => {
  const notifyResult = (isError: boolean, content: string) => {
    window.postMessage(
      {
        type: SubscribeActions.TOOL_CALL_RESULT,
        data: {
          tool_name: toolName,
          tool_result: {
            content: content,
            isError: isError,
          },
          tool_id: toolId,
        },
      },
      '*',
    );
  }

  if (!toolParams?.query?.trim?.()?.length) {
    return notifyResult(true, 'Error: Missing query')
  } else if (toolParams?.allowed_domains?.length && toolParams?.blocked_domains?.length) {
    return notifyResult(true, 'Error: Cannot specify both allowed_domains and blocked_domains in the same request')
  }
  const { setIsStreaming, setLoadingMessage, resetMessage } = useChatStreamStore.getState();
  resetMessage()
  setLoadingMessage('正在联网检索中...')
  setIsStreaming(true)
  new AigwCodebase({
    codebase_chat_mode: 'web_search',
    max_tokens: 10240,
    temperature: 0,
    model: "claude-sonnet-4-20250514",
    stream: true,
    messages: [{
      role: ChatRole.System,
      content: 'You are an assistant for performing a web search tool use',
    }, {
      role: ChatRole.User,
      content: 'Perform a web search for the query' + toolParams.query
    }],
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        allowed_domains: toolParams?.allowed_domains || [],
        blocked_domains: toolParams?.blocked_domains || [],
        max_uses: 8, // Hardcoded to 8 searches maximum
      }
    ]
  }, {
    onMessage: (content: string) => {
      useChatStreamStore.setState((state) => {
        state.message.content = content
      })
    },
    onFinish: (content: string) => {
      resetMessage()
      setIsStreaming(false)
      setLoadingMessage('')
      notifyResult(false, content)
    },
    onError: (err: Error) => {
      useChatStreamStore.setState((state) => {
        state.message.content = ''
      })
      setIsStreaming(false)
      setLoadingMessage('')
      notifyResult(true, `Error: ${getErrorMessage(err)}`)
    },
    onController: (controller) => {
      webSearchController = controller
    }
  })

}