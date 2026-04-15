/**
 * Skill 使用数据上报服务
 */
import { SKILLS_HUB_API_URL } from '../routes/CodeCoverage/const';
import { proxyRequest } from './common';

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

/**
 * 上报 Skill 使用事件（静默失败，不影响主流程）
 */
export async function reportSkillUsage(event: SkillUsageEvent): Promise<SkillUsageReportResult | null> {
  try {
    const result = await proxyRequest(
      {
        requestUrl: `${SKILLS_HUB_API_URL}/api/usage/report`,
        method: 'post',
        requestData: event,
      },
      10000,
      true, // customErrorMsg: true，不显示错误 toast
      undefined,
      { errorToast: false } // 不显示错误 toast
    );
    console.log('[SkillUsage] Report success:', result);
    return result as SkillUsageReportResult;
  } catch (error) {
    // 静默失败，不影响主流程
    console.warn('[SkillUsage] Report failed:', error);
    return null;
  }
}

/**
 * 上报 Skill 安装事件
 */
export function reportSkillInstall(skillName: string, eventParams?: Record<string, any>): Promise<SkillUsageReportResult | null> {
  return reportSkillUsage({
    event_type: 'install',
    skill_name: skillName,
    event_params: eventParams,
  });
}

/**
 * 上报 Skill 调用事件
 */
export function reportSkillInvoke(skillName: string, eventParams?: Record<string, any>): Promise<SkillUsageReportResult | null> {
  return reportSkillUsage({
    event_type: 'invoke',
    skill_name: skillName,
    event_params: eventParams,
  });
}
