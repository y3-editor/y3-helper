export enum TRStatusType {
  dashboard = 'dashboard',
  add = 'add',
  edit = 'edit',
  delete = 'delete',
  open = 'open',
  close = 'closed',
  info = 'info',
  aiReview = 'aiReview',
  retry = 'retry'
}

export enum ReviewRequestStatus {
  Open = 'open',
  Closed = 'closed',
  Initializing = 'initializing',
  Failed = 'failed'
}

export const REVIEW_STATUS_LABELS={
  [ReviewRequestStatus.Open]: '打开',
  [ReviewRequestStatus.Closed]: '关闭',
  [ReviewRequestStatus.Initializing]: '计算中',
  [ReviewRequestStatus.Failed]: '失败'
}

export const REVIEWER_STATUS_MAP = {
  init: {
    key: 'init',
    label: 'Review中',
    color: '#2563eb',
  },
  approve: {
    key: 'approve',
    label: '同意变更',
    color: '#2faa2f',
  },
  unresolved: {
    key: 'unresolved',
    label: '等待更新中',
    color: '#ff9326',
  },
  ai_failure: {
    key: 'ai_failure',
    label: 'Review 已完成，过程存在部分异常',
    color: '#ffa033',
  },
};

/**
 * 1. 通过 html 渲染环境变量
 * 2. 本地启动时在 vite.config.ts 设置 __TEAM_REVIEW_API_URL__
 * 3. 线上环境在 nginx 设置 __TEAM_REVIEW_API_URL__
 * 4. 插件测试包通过 INIT_DATA 事件调用 setTeamReviewApiUrl 事件设置 __TEAM_REVIEW_API_URL__
 * 5. 默认情况下保底请求正式环境
 */
export let TEAM_REVIEW_API_URL = (window as any).TEAM_REVIEW_API_URL;

// 开发环境优先使用本地设置，其他环境下如果传入有值则更新
export const setTeamReviewApiUrl = (url: string) => {
  if (!url || import.meta.env.DEV) return;
  TEAM_REVIEW_API_URL = url;
};

export const RR_LIST_SEARCH_CONFIG_KEY = 'rr_list_search_config';

export enum SWITCH_TYPE {
  prev = 'prev',
  next = 'next',
}

// issue反馈操作，使用特性交互的项目列表
export const DISABLED_PROJECTS = ['h72', 'dep305', 'dh2'];
