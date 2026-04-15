import type { ToolCall } from '../../../services';
import { jsonrepair } from 'jsonrepair';

export interface AskUserQuestionParams {
  question: string;
  options?: string[];
  multiSelect?: boolean;
}

export interface AskUserQuestionResult {
  selectedOptions: string[];
  customInput?: string;
}

export const TOOL_NAME = 'ask_user_question';

export const DESCRIPTION = `Use this tool when you need to ask the user questions during execution. This allows you to:
  - Gather user preferences or requirements
  - Clarify ambiguous instructions
  - Get decisions on implementation choices as you work
  - Offer choices to the user about what direction to take.
Usage notes:
  - Users will always be able to select "Other" to provide custom text input
  - Use multiSelect: true to allow multiple answers to be selected for a question
  - If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label
  - If there are more than one question, seperate them into different toolcall, do not ask multiple questions in one toolcall.
  - When in spec mode (designing proposals or planning), always use this tool to ask for clarification from the user.
`;

export const Tool = {
  type: 'function',
  function: {
    name: TOOL_NAME,
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user, use plaintext, no markdown. And keep it simple for only question itself.',
        },
        options: {
          type: 'array',
          description:
            'Array of string options for the user to choose from. If you recommend a specific option, make that the first option and add "(Recommended)" at the end.',
          items: {
            type: 'string',
          },
        },
        multiSelect: {
          type: 'boolean',
          description:
            'Whether multiple options can be selected. Default is false.',
        },
      },
      required: ['question'],
    },
  },
};

export function getToolParams(tool: ToolCall): AskUserQuestionParams {
  let toolParams: AskUserQuestionParams;
  try {
    toolParams = JSON.parse(tool.function?.arguments || '{}');
  } catch {
    try {
      toolParams = JSON.parse(jsonrepair(tool.function?.arguments || '{}'));
    } catch {
      toolParams = { question: '' }
    }
  }
  return toolParams;
}

export function formatResultContent(result: AskUserQuestionResult): string {
  const parts: string[] = [];

  if (result.selectedOptions && result.selectedOptions.length > 0) {
    parts.push(`Selected: ${result.selectedOptions.join(', ')}`);
  }

  if (result.customInput) {
    parts.push(`Custom input: ${result.customInput}`);
  }

  return parts.join('\n') || 'No selection made';
}
