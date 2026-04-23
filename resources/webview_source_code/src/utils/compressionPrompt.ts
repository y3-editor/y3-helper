/**
 * Compression prompt generation utilities - Pure functions
 * Based on Claude Code's 8-section compression approach
 */

import { ChatMessage } from '../services';
import {
  formatSkillContent,
  SkillData,
  parseSkillToolResult,
  createSkillToolId,
} from '../store/skills';
import { BroadcastActions, SubscribeActions } from '../PostMessageProvider';

const SKILL_FETCH_TIMEOUT = 10000;
const SKILL_PLACEHOLDER_PATTERN = /\{\{SKILL:([^}]+)\}\}/g;

export const compressionSkillToolIds = new Set<string>();

function formatSkillToolResult(content: string): string {
  try {
    const data = JSON.parse(content);
    if (data?.name && data?.content && data?.source) {
      return formatSkillContent(data as SkillData);
    }
  } catch {
    // not JSON, return as-is
  }
  return content;
}

function fetchSkillFromIDE(skillName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const toolId = createSkillToolId();
    compressionSkillToolIds.add(toolId);
    let resolved = false;

    const cleanup = () => {
      resolved = true;
      compressionSkillToolIds.delete(toolId);
      window.removeEventListener('message', handleMessage);
    };

    const handleMessage = (event: MessageEvent) => {
      if (resolved) return;

      const { type, data } = event.data || {};
      if (
        type !== SubscribeActions.TOOL_CALL_RESULT ||
        data?.tool_id !== toolId ||
        data?.tool_name !== 'use_skill'
      ) {
        return;
      }

      cleanup();

      const toolResult = data.tool_result;
      if (toolResult?.isError || !toolResult?.content) {
        console.warn(`[fetchSkillFromIDE] Failed to fetch skill: ${skillName}`);
        resolve(null);
        return;
      }

      const skillData = parseSkillToolResult(toolResult.content);
      resolve(skillData ? formatSkillContent(skillData) : toolResult.content);
    };

    window.addEventListener('message', handleMessage);

    window.parent.postMessage(
      {
        type: BroadcastActions.TOOL_CALL,
        data: {
          tool_name: 'use_skill',
          tool_params: { skill_name: skillName },
          tool_id: toolId,
        },
      },
      '*',
    );

    setTimeout(() => {
      if (resolved) return;
      cleanup();
      console.warn(`[fetchSkillFromIDE] Timeout fetching skill: ${skillName}`);
      resolve(null);
    }, SKILL_FETCH_TIMEOUT);
  });
}

function extractSkillContentFromMessages(
  messages: ChatMessage[],
): Map<string, string> {
  const skillContentMap = new Map<string, string>();

  for (const message of messages) {
    if (!message.tool_calls || !message.tool_result) continue;

    for (const toolCall of message.tool_calls) {
      if (toolCall.function.name !== 'use_skill') continue;

      try {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        const skillName = args.skill_name;
        const toolResult = message.tool_result[toolCall.id];

        if (skillName && toolResult && !toolResult.isError && toolResult.content) {
          skillContentMap.set(skillName, formatSkillToolResult(toolResult.content));
        }
      } catch (e) {
        console.warn('[extractSkillContentFromMessages] Failed to parse:', e);
      }
    }
  }

  return skillContentMap;
}

function extractSkillPlaceholders(summary: string): string[] {
  SKILL_PLACEHOLDER_PATTERN.lastIndex = 0;
  const skillNames: string[] = [];
  let match;
  while ((match = SKILL_PLACEHOLDER_PATTERN.exec(summary)) !== null) {
    skillNames.push(match[1].trim());
  }
  return [...new Set(skillNames)];
}

/**
 * Replace {{SKILL:skill-name}} placeholders in the summary with actual skill content.
 * Falls back to fetching from IDE via postMessage if not found in messages.
 */
export async function replaceSkillPlaceholders(
  summary: string,
  compressedMessages: ChatMessage[] = [],
): Promise<string> {
  const skillNames = extractSkillPlaceholders(summary);
  if (skillNames.length === 0) {
    return summary;
  }

  const skillContentMap = extractSkillContentFromMessages(compressedMessages);
  const missingSkills = skillNames.filter((name) => !skillContentMap.has(name));

  if (missingSkills.length > 0) {
    console.log('[replaceSkillPlaceholders] Fetching missing skills from IDE:', missingSkills);
    await Promise.all(
      missingSkills.map(async (skillName) => {
        const content = await fetchSkillFromIDE(skillName);
        if (content) {
          skillContentMap.set(skillName, content);
        }
      }),
    );
  }

  SKILL_PLACEHOLDER_PATTERN.lastIndex = 0;
  return summary.replace(SKILL_PLACEHOLDER_PATTERN, (match, skillName) => {
    const skillContent = skillContentMap.get(skillName.trim());
    if (skillContent) {
      console.log(`[replaceSkillPlaceholders] Replaced: ${skillName}`);
      return skillContent;
    }
    console.warn(`[replaceSkillPlaceholders] Not found: ${skillName}`);
    return match;
  });
}

/**
 * Generate 8-section compression prompt following Claude Code's structure
 * Pure function - generates prompt string based on input
 */
export function generateCompressionPrompt(additionalInstructions?: string): string {
  const basePrompt = `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:

1. Chronologically analyze each message and section of the conversation. For each section thoroughly identify:
   - The user's explicit requests and intents
   - Your approach to addressing the user's requests
   - Key decisions, technical concepts and code patterns
   - Specific details like:
     - file names
     - full code snippets
     - function signatures
     - file edits
  - Errors that you ran into and how you fixed them
  - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
2. Double-check for technical accuracy and completeness, addressing each required element thoroughly.

Your summary should include the following sections:

1. Primary Request and Intent: Capture all of the user's explicit requests and intents in detail
2. Key Technical Concepts: List all important technical concepts, technologies, and frameworks discussed.
3. Files and Code Sections: Enumerate specific files and code sections examined, modified, or created. Pay special attention to the most recent messages and include full code snippets where applicable and include a summary of why this file read or edit is important.
4. Errors and fixes: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
5. Problem Solving: Document problems solved and any ongoing troubleshooting efforts.
6. All user messages: List ALL user messages that are not tool results. These are critical for understanding the users' feedback and changing intent.
6. Pending Tasks: Outline any pending tasks that you have explicitly been asked to work on.
7. Current Work: Describe in detail precisely what was being worked on immediately before this summary request, paying special attention to the most recent messages from both user and assistant. Include file names and code snippets where applicable.
8. Optional Next Step: List the next step that you will take that is related to the most recent work you were doing. IMPORTANT: ensure that this step is DIRECTLY in line with the user's explicit requests, and the task you were working on immediately before this summary request. If your last task was concluded, then only list next steps if they are explicitly in line with the users request. Do not start on tangential requests without confirming with the user first.

If there is a next step, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no drift in task interpretation.

Here's an example of how your output should be structured:

<example>
<analysis>
[Your thought process, ensuring all points are covered thoroughly and accurately]
</analysis>

<summary>
1. Primary Request and Intent:
   [Detailed description]

2. Key Technical Concepts:
   - [Concept 1]
   - [Concept 2]
   - [...]

3. Files and Code Sections:
   - [File Name 1]
      - [Summary of why this file is important]
      - [Summary of the changes made to this file, if any]
      - [Important Code Snippet]
   - [File Name 2]
      - [Important Code Snippet]
   - [...]

4. Errors and fixes:
    - [Detailed description of error 1]:
      - [How you fixed the error]
      - [User feedback on the error if any]
    - [...]

5. Problem Solving:
   [Description of solved problems and ongoing troubleshooting]

6. All user messages:
    - [Detailed non tool use user message]
    - [...]

7. Pending Tasks:
   - [Task 1]
   - [Task 2]
   - [...]

8. Current Work:
   [Precise description of current work]

9. Optional Next Step:
   [Optional Next step to take]

10. Active Skills (if applicable):
   {{SKILL:skill-name-1}}
   {{SKILL:skill-name-2}}

</summary>
</example>

## Skills Preservation Instructions

When creating the summary, pay special attention to skills usage:

1. **Detect skill invocations**: Look for evidence of skill usage in the conversation:
   - Tool calls with \`"name": "use_skill"\` and \`"skill_name": "..."\` parameter
   - Tool results containing \`<activated_skill name="...">\` tags with skill content

2. **Extract skill names**: From the detected skill invocations, extract the exact skill names that were loaded.

3. **Determine task completion**: Assess whether the user's primary task has been fully completed.

4. **Generate skill placeholders**: If skills were actively used AND the task is NOT yet complete, you MUST include section "10. Active Skills" in your summary with skill placeholders using this exact format:
   \`{{SKILL:skill-name}}\`

   Each skill should be on its own line. Use the exact skill name from the original tool call.

Example:
- If \`use_skill\` was called with \`"skill_name": "playwright-skill"\` and \`"skill_name": "code-review-skill"\`
- And the task is not complete
- Output:
  \`\`\`
  10. Active Skills:
     {{SKILL:playwright-skill}}
     {{SKILL:code-review-skill}}
  \`\`\`

The placeholders will be automatically replaced with the actual skill content after compression.

Please provide your summary based on the conversation so far, following this structure and ensuring precision and thoroughness in your response.

There may be additional summarization instructions provided in the included context. If so, remember to follow these instructions when creating the above summary. Examples of instructions include:
<example>
## Compact Instructions
When summarizing the conversation focus on typescript code changes and also remember the mistakes you made and how you fixed them.
</example>

<example>
# Summary instructions
When you are using compact - please focus on test output and code changes. Include file reads verbatim.
</example>

`;

  // If additional instructions provided, append them
  if (additionalInstructions && additionalInstructions.trim() !== '') {
    return basePrompt + `\n\n附加说明：\n${additionalInstructions}`;
  }

  return basePrompt;
}