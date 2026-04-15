import { RULES_PROMPT } from './rules';
import {
  OPEN_SPEC_PROPOSAL_PROMPT,
  OPEN_SPEC_APPLY_PROMPT,
  OPEN_SPEC_ARCHIVE_PROMPT
} from './openSpecPrompts';
import * as specKitPromptsPS from './specKitPromptsPS';
import * as specKitPromptsSH from './specKitPromptsSH';
import { OPEN_SPEC_SETUP_PROMPT, SPECKIT_SETUP_PROMPT } from './spec';
import { isWin } from '../../utils';

export interface BuiltInPrompt {
  name: string;
  description: string;
  prompt: string;
}

export const BUILT_IN_PROMPTS: BuiltInPrompt[] = [
  RULES_PROMPT,
  OPEN_SPEC_SETUP_PROMPT,
  SPECKIT_SETUP_PROMPT
];

export const BUILT_IN_PROMPTS_OPENSPEC: BuiltInPrompt[] = [
  OPEN_SPEC_PROPOSAL_PROMPT,
  OPEN_SPEC_APPLY_PROMPT,
  OPEN_SPEC_ARCHIVE_PROMPT
]

// 根据系统选择对应的 speckit prompts
function getSpecKitPrompts() {
  return isWin() ? specKitPromptsPS : specKitPromptsSH;
}

export const BUILT_IN_PROMPTS_SPECKIT: BuiltInPrompt[] = [
  getSpecKitPrompts().SPECKIT_CONSTITUTION_PROMPT,
  getSpecKitPrompts().SPECKIT_SPECIFY_PROMPT,
  getSpecKitPrompts().SPECKIT_PLAN_PROMPT,
  getSpecKitPrompts().SPECKIT_TASKS_PROMPT,
  getSpecKitPrompts().SPECKIT_IMPLEMENT_PROMPT,
  getSpecKitPrompts().SPECKIT_CLARIFY_PROMPT,
  getSpecKitPrompts().SPECKIT_ANALYZE_PROMPT,
  getSpecKitPrompts().SPECKIT_CHECKLIST_PROMPT
]

export const specPromptMap: {
  [propName: string]: string
} = {
  'openspec-apply': OPEN_SPEC_APPLY_PROMPT.prompt,
  'openspec-archive': OPEN_SPEC_ARCHIVE_PROMPT.prompt,
  'openspec-proposal': OPEN_SPEC_PROPOSAL_PROMPT.prompt,
  'speckit.constitution': getSpecKitPrompts().SPECKIT_CONSTITUTION_PROMPT.prompt,
  'speckit.specify': getSpecKitPrompts().SPECKIT_SPECIFY_PROMPT.prompt,
  'speckit.plan': getSpecKitPrompts().SPECKIT_PLAN_PROMPT.prompt,
  'speckit.tasks': getSpecKitPrompts().SPECKIT_TASKS_PROMPT.prompt,
  'speckit.implement': getSpecKitPrompts().SPECKIT_IMPLEMENT_PROMPT.prompt,
  'speckit.clarify': getSpecKitPrompts().SPECKIT_CLARIFY_PROMPT.prompt,
  'speckit.analyze': getSpecKitPrompts().SPECKIT_ANALYZE_PROMPT.prompt,
  'speckit.checklist': getSpecKitPrompts().SPECKIT_CHECKLIST_PROMPT.prompt
}
