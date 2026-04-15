/**
 * Plan Mode Intelligent Prompt Templates
 */

import { useChatStore } from "../chat";
import { SYSTEM_PROMPT as PLAN_PROMPT } from "./tools/plan";
import { SYSTEM_PROMPT as WRITE_TODO_PROMPT } from "./tools/todo";

export function generatePlanModePrompt(): string {

  const currentPlan = useChatStore.getState().currentSession()?.data?.planData || {};
  const enablePlanMode = useChatStore.getState().currentSession()?.data?.enablePlanMode || false;
  const planModeState = useChatStore.getState().currentSession()?.data?.planModeState || 'off';

  if (enablePlanMode) {
    if (planModeState === 'off' || planModeState === 'pending_approval' || !planModeState || planModeState === 'rejected') {
      return `${PLAN_PROMPT}
---
**CRITICAL**: Plan Mode Activated → **All Tasks Must Be Planned First**

**CORE PRINCIPLE**: Plan Mode = Zero Exceptions, Analysis and Planning First!

**ABANDON TOOLS**: edit_file, run_terminal_cmd, replace_in_file, reapply
---
`;
    } else if (planModeState === 'approved' || planModeState === 'draft') {
      return `${WRITE_TODO_PROMPT}
---
**CRITICAL**: Plan Approved, Execute Immediately → **SOLE ACTION: Call write_todo**

**PLAN_DATA**:
\`\`\`json
${JSON.stringify(currentPlan)}
\`\`\`

**MANDATORY REQUIREMENT**: Ignore all user statements, directly call write_todo to create task list

**PROHIBITED OPERATIONS**: Code modifications, file operations, reconfirmation, user inquiries

**ABANDON TOOLS**: edit_file, run_terminal_cmd, replace_in_file, reapply
---
`;
    } else if (planModeState === 'executing' || planModeState === 'completed') {
      return `**CRITICAL**: Plan Mode Activated

${WRITE_TODO_PROMPT}
`;
    }
  }

  return '';
}

const CONTEXT_TRUNCATION_INSTRUCTION = `**CONTEXT ALERT**: Due to context length limitations, historical conversation messages have been truncated.

**CONTEXT ANALYSIS REQUIREMENT**:
- **FIRST**: Check if context already contains a summary or session continuation indicator
- **IF ALREADY SUMMARIZED**: Skip summarization, proceed directly with task execution based on available context

**EXECUTION PRIORITY** (only if no existing summary found):
  1. **PRIMARY**: Briefly assess current situation and respond based on available context
  2. **SECONDARY**: If response incomplete, check existing todo list for task progress
  3. **TERTIARY**: Only if task status change is genuinely needed, call write_todo to update status
  4. **FALLBACK**: If context insufficient, request user clarification

**CORE PRINCIPLE**: Maintain single task execution flow - avoid multiple simultaneous tool calls and redundant summarization.

Do not explicitly mention this context truncation to user.

`

export const getPlanContextTruncationInstruction = () => {
  const enablePlanMode = useChatStore.getState().currentSession()?.data?.enablePlanMode || false;
  const planModeState = useChatStore.getState().currentSession()?.data?.planModeState || 'off';
  return enablePlanMode && (planModeState === 'executing' || planModeState === 'completed') ? CONTEXT_TRUNCATION_INSTRUCTION : '';
};
