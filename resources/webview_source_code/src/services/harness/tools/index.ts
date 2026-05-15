/**
 * @file harness tools 注册表（试点雏形）
 *
 * 本注册表作为"工具特化逻辑按工具分包"结构的起点。
 *
 * 当前状态：仅注册 `use_skill` 作为试点项（参见 OpenSpec change
 * add-use-skill-tool-module）。其他工具（make_plan / write_todo /
 * write / edit 等）已存在独立模块（`./plan`、`./todo` 等），但尚未
 * 接入本注册表——等试点完成后决定是否推广。
 *
 * 两条工具管线（`src/utils/toolCall.tsx`、
 * `src/modules/subagent/core/toolCallHandler.ts`）目前直接 import
 * 各工具模块即可，不强制走本注册表；注册表仅用于暴露"哪些工具已
 * 按新结构组织"的元信息，供未来统一分发逻辑使用。
 */

import type { ToolResult } from '../../../services';
import type { SkillData } from '../../../store/skills';
import type { UseSkillInvokeCtx } from './use_skill';
import {
  onInvoked as useSkillOnInvoked,
  processResult as useSkillProcessResult,
} from './use_skill';

/**
 * 工具模块的统一形状。
 *
 * - `processResult`：纯函数，返回给模型看的字符串（可选）
 * - `onInvoked`：副作用钩子，接收已解析的工具数据与管线上下文（可选）
 *
 * 具体工具模块可以只实现其中一个。
 */
export interface ToolModule<Ctx = { source: 'main' | 'subagent' }, Parsed = unknown> {
  processResult?: (result: ToolResult, parsed?: Parsed) => string;
  onInvoked?: (parsed: Parsed, ctx: Ctx) => void;
}

/**
 * 试点阶段的工具注册表。故意只注册 `use_skill`，
 * 推广决策完成前不扩展。
 */
export const TOOL_REGISTRY: {
  use_skill: ToolModule<UseSkillInvokeCtx, SkillData[]>;
} = {
  use_skill: {
    processResult: useSkillProcessResult,
    onInvoked: useSkillOnInvoked,
  },
};
