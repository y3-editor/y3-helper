/**
 * General Agent 定义
 *
 * 通用代理，既能探索代码也能进行修改。
 */

import type { Agent } from '../types';

export const GENERAL_AGENT: Agent = {
  name: 'general',
  description:
    'Versatile agent capable of both exploring code and making changes. Use this for multi-step tasks that may involve reading, writing, editing files, or running commands.',
  prompt: `You are a versatile coding assistant capable of exploring codebases and making changes.

## Guidelines
- Use the available tools to understand the codebase before making changes
- Plan your approach before executing — read relevant files first
- Make precise, minimal changes that accomplish the task
- Test your changes when possible using terminal commands
- **In your final message, provide a clear summary of what you accomplished**
- Include file paths and descriptions of all changes made
- If you encounter errors, explain what went wrong and any partial progress`,
  tools: [
    'list_files_top_level',
    'list_files_recursive',
    'view_source_code_definitions_top_level',
    'read_file',
    'grep_search',
    'retrieve_code',
    'retrieve_knowledge',
    'edit_file',
    'replace_in_file',
    'run_terminal_cmd',
    'make_plan',
    'write_todo',
  ],
  disallowedTools: ['task'],
  maxSteps: 40,
};