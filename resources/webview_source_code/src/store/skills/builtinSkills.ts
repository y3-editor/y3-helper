import type { SkillIndexItem } from '.';

// Y3 不使用内置 OpenSpec Skills，导出空数组
export const OPSX_BUILTIN_SKILLS: SkillIndexItem[] = [];

export function getBuiltinSkillContent(_skillName: string): string {
  return '';
}
