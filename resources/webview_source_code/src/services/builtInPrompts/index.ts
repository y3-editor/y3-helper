import { RULES_PROMPT } from './rules';
import {
  OPEN_SPEC_PROPOSAL_PROMPT,
  OPEN_SPEC_APPLY_PROMPT,
  OPEN_SPEC_ARCHIVE_PROMPT,
  OPEN_SPEC_UPGDATE_PROMPT
} from './openSpecPrompts';
import {
  OPSX_EXPLORE_PROMPT,
  OPSX_NEW_PROMPT,
  OPSX_CONTINUE_PROMPT,
  OPSX_APPLY_PROMPT,
  OPSX_FF_PROMPT,
  OPSX_SYNC_PROMPT,
  OPSX_ARCHIVE_PROMPT,
  OPSX_BULK_ARCHIVE_PROMPT,
  OPSX_VERIFY_PROMPT,
  OPSX_ONBOARD_PROMPT
} from './openSpecPromptsV1';
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

// OpenSpec 0.23 命令集
export const BUILT_IN_PROMPTS_OPENSPEC_V023: BuiltInPrompt[] = [
  OPEN_SPEC_PROPOSAL_PROMPT,
  OPEN_SPEC_APPLY_PROMPT,
  OPEN_SPEC_ARCHIVE_PROMPT,
  OPEN_SPEC_UPGDATE_PROMPT
]

// OpenSpec 1.x (OPSX) 命令集
export const BUILT_IN_PROMPTS_OPENSPEC_V1: BuiltInPrompt[] = [
  OPSX_EXPLORE_PROMPT,
  OPSX_NEW_PROMPT,
  OPSX_CONTINUE_PROMPT,
  OPSX_FF_PROMPT,
  OPSX_APPLY_PROMPT,
  OPSX_VERIFY_PROMPT,
  OPSX_SYNC_PROMPT,
  OPSX_ARCHIVE_PROMPT,
  OPSX_BULK_ARCHIVE_PROMPT,
  OPSX_ONBOARD_PROMPT
];

// 根据版本获取对应的 OpenSpec 命令集
export function getOpenSpecPromptsByVersion(version?: '0.23' | '1.x' | 'unknown'): BuiltInPrompt[] {
  if (version === '1.x') {
    return BUILT_IN_PROMPTS_OPENSPEC_V1;
  }
  // 默认返回 0.23
  return BUILT_IN_PROMPTS_OPENSPEC_V023;
}

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
  // OpenSpec 0.23 命令
  'openspec-apply': OPEN_SPEC_APPLY_PROMPT.prompt,
  'openspec-archive': OPEN_SPEC_ARCHIVE_PROMPT.prompt,
  'openspec-proposal': OPEN_SPEC_PROPOSAL_PROMPT.prompt,
  'openspec-update': OPEN_SPEC_UPGDATE_PROMPT.prompt,
  // OpenSpec 1.x (OPSX) 命令
  'opsx:explore': OPSX_EXPLORE_PROMPT.prompt,
  'opsx:new': OPSX_NEW_PROMPT.prompt,
  'opsx:continue': OPSX_CONTINUE_PROMPT.prompt,
  'opsx:apply': OPSX_APPLY_PROMPT.prompt,
  'opsx:ff': OPSX_FF_PROMPT.prompt,
  'opsx:sync': OPSX_SYNC_PROMPT.prompt,
  'opsx:archive': OPSX_ARCHIVE_PROMPT.prompt,
  'opsx:bulk-archive': OPSX_BULK_ARCHIVE_PROMPT.prompt,
  'opsx:verify': OPSX_VERIFY_PROMPT.prompt,
  'opsx:onboard': OPSX_ONBOARD_PROMPT.prompt,
  // SpecKit 命令
  'speckit.constitution': getSpecKitPrompts().SPECKIT_CONSTITUTION_PROMPT.prompt,
  'speckit.specify': getSpecKitPrompts().SPECKIT_SPECIFY_PROMPT.prompt,
  'speckit.plan': getSpecKitPrompts().SPECKIT_PLAN_PROMPT.prompt,
  'speckit.tasks': getSpecKitPrompts().SPECKIT_TASKS_PROMPT.prompt,
  'speckit.implement': getSpecKitPrompts().SPECKIT_IMPLEMENT_PROMPT.prompt,
  'speckit.clarify': getSpecKitPrompts().SPECKIT_CLARIFY_PROMPT.prompt,
  'speckit.analyze': getSpecKitPrompts().SPECKIT_ANALYZE_PROMPT.prompt,
  'speckit.checklist': getSpecKitPrompts().SPECKIT_CHECKLIST_PROMPT.prompt
}