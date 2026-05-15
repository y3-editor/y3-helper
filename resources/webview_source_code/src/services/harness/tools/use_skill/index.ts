/**
 * @file use_skill 工具模块
 *
 * 该模块是主 Agent 与 Subagent 两条工具管线共享的 `use_skill` 特化逻辑
 * 单一来源。任何关于 `use_skill` 的展示格式化都 MUST 放在本文件里，
 * 两条管线 MUST 通过导出的 `parseSkillToolResults` / `processResult` /
 * `onInvoked` 调用。
 *
 * Y3 适配：上游在此模块内做埋点上报（reportSkillInvoke）。Y3Maker 不需要
 * 埋点，`onInvoked` 仅保留签名作为 no-op，供注册表与两条管线统一调用。
 */

import type { ToolResult } from '../../../../services';
import {
  formatSkillContent,
  parseSkillToolResult,
  type SkillData,
} from '../../../../store/skills';

/**
 * `onInvoked` 副作用的上下文。
 *
 * - `source: 'main'`     → 主 Agent 管线（`utils/toolCall.tsx`）触发
 * - `source: 'subagent'` → Subagent 管线（`modules/subagent/core/toolCallHandler.ts`）触发
 */
export interface UseSkillInvokeCtx {
  source: 'main' | 'subagent';
}

const EMPTY_SKILL_DATA_LIST: SkillData[] = [];

/**
 * 解析 `use_skill` 工具的返回内容，得到一个或多个 SkillData。
 *
 * 兼容两种返回格式：
 * 1. JSON.stringify 出的对象或数组
 * 2. 单个 skill 的原始字符串内容
 */
export function parseSkillToolResults(content: string): SkillData[] {
  try {
    const parsed: unknown = JSON.parse(content);
    const skillDataArray = Array.isArray(parsed) ? parsed : [parsed];

    return skillDataArray
      .map((skillDataRaw) => parseSkillToolResult(JSON.stringify(skillDataRaw)))
      .filter((skillData): skillData is SkillData => Boolean(skillData));
  } catch {
    const skillData = parseSkillToolResult(content);
    return skillData ? [skillData] : EMPTY_SKILL_DATA_LIST;
  }
}

/**
 * 把 `use_skill` 的工具结果转换成返回给模型的展示字符串。
 *
 * 纯函数，不产生副作用。
 *
 * @param result 工具执行结果
 * @param skillDataList 已解析的 skill 数据；调用方同时需要格式化时应先解析一次并复用，避免重复解析
 * @returns 返回给模型的字符串；若解析不出任何 skill，退化为原始 content
 */
export function processResult(
  result: ToolResult,
  skillDataList?: SkillData[],
): string {
  const resolvedSkillDataList = skillDataList ?? parseSkillToolResults(result.content);

  if (resolvedSkillDataList.length) {
    return resolvedSkillDataList.map(formatSkillContent).join('\n\n---\n\n');
  }

  return result.content;
}

/**
 * `use_skill` 调用成功后的副作用钩子。
 *
 * Y3 不需要埋点，保留 no-op 实现以兼容注册表 / 两条管线调用约定。
 */
export function onInvoked(
  _skillDataList: SkillData[],
  _ctx: UseSkillInvokeCtx,
): void {
  // no-op (Y3 不上报 skill 调用埋点)
}
