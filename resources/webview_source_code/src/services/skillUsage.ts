/**
 * Skill 使用数据上报服务 — Y3 stub
 *
 * Y3Maker 不需要 CodeMaker 的 skill 使用埋点（install / invoke），
 * 此文件保留导出签名以兼容上游代码，所有上报函数为 no-op。
 */

export type SkillUsageEventType = 'install' | 'invoke';

export interface SkillUsageEvent {
  event_type: SkillUsageEventType;
  skill_name: string;
  skill_id?: string;
  namespace?: string;
  count?: number;
  event_params?: Record<string, any>;
}

export interface SkillUsageReportResult {
  id: string;
  event_type: string;
  skill_id: string | null;
  skill_name: string | null;
  namespace: string;
  count: number;
  user_id: string | null;
  user_verified: boolean;
  created_at: number;
}

export async function reportSkillUsage(_event: SkillUsageEvent): Promise<SkillUsageReportResult | null> {
  return null;
}

export function reportSkillInstall(_skillName: string, _eventParams?: Record<string, any>): Promise<SkillUsageReportResult | null> {
  return Promise.resolve(null);
}

export function reportSkillInvoke(_skillName: string, _eventParams?: Record<string, any>): Promise<SkillUsageReportResult | null> {
  return Promise.resolve(null);
}
