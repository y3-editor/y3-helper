export enum CodeCoverageStatusType {
  dashboard = 'dashboard',
  delete = 'delete',
  open = 'open',
  info = 'info',
  coverageInfo = 'coverageInfo',
  addCoverage = 'addCoverage',
  reset = 'reset',
  deleteWorksheet = 'deleteWorksheet'
}

export interface RenderCoverageDetails {
  is_abnormal: boolean;
  user: string;
  fullname: string;
  coverage: number;
  task_id: string;
  covered_code_lines: number;
  all_code_lines: number;
  branch?: string;
  no_need_test: boolean;
}

/**
 * 1. 通过 html 渲染环境变量
 * 2. 本地启动时在 vite.config.ts 设置 __CODE_COVERAGE_API_URL__
 * 3. 线上环境在 nginx 设置 __CODE_COVERAGE_API_URL__
 * 4. 插件测试包通过 INIT_DATA 事件调用 setCodeCoverageApiUrl 事件设置 __CODE_COVERAGE_API_URL__
 * 5. 默认情况下保底请求正式环境
 */
export let CODE_COVERAGE_API_URL = (window as any).CODE_COVERAGE_API_URL;

export const DEV_CLOUD_UI = (window as any).DEV_CLOUD_UI;

export const CODEMAKER_UI = (window as any).CODEMAKER_UI;

export const OFFICE_BM_API_URL = (window as any).OFFICE_BM_API_URL;

export const CODE_MAKER_SEARCH_CONFIG_API_URL = (window as any).CODE_MAKER_SEARCH_CONFIG_API_URL;

export const MCP_API_URL = (window as any).MCP_API_URL;

export const SKILLS_HUB_API_URL = (window as any).SKILLS_HUB_API_URL;

// 开发环境优先使用本地设置，其他环境下如果传入有值则更新
export const setCodeCoverageApiUrl = (url: string) => {
  if (!url || import.meta.env.DEV) return;
  CODE_COVERAGE_API_URL = url;
};
export function extractBranch(input: string) {
  // 先用 '-' 分隔字符串
  const parts = input.split('-');

  // 判断是否能分成四份
  if (parts.length === 4) {
    return parts[2]; // 返回第三部分（索引为2）
  } else {
    throw new Error('Invalid input format'); // 否则抛出错误
  }
}
export function capitalizeFirstLetter(input: string | null) {
  if (!input) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export enum CoverageType {
  code = 'code',
  excel = 'excel'
}
