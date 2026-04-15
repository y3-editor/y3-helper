import type { Step, Styles } from 'react-joyride';

/** 引导触发方式 */
export enum TourTriggerType {
  /** 手动触发 */
  Manual = 'manual',
  /** 页面加载时自动触发 */
  PageEnter = 'page-enter',
  /** 事件触发 */
  Event = 'event',
}

/** 引导触发配置 */
export interface TourTriggerConfig {
  /** 触发类型 */
  type: TourTriggerType;
  /** 页面路由匹配（用于 PageEnter 类型） */
  pageRoute?: string;
  /** 事件名称（用于 Event 类型） */
  eventName?: string;
  /** 触发延迟（毫秒），等待 DOM 元素就绪 */
  delay?: number;
  /** 自定义触发条件，返回 true 时才触发 */
  condition?: () => boolean;
}

/**
 * 扩展的 Step 类型，支持步骤生命周期回调
 */
export interface TourStep extends Step {
  /**
   * 进入该步骤时的回调（步骤显示时立即触发）
   * @param stepIndex 当前步骤索引
   */
  onStepEnter?: (stepIndex: number) => void;
  /**
   * 完成该步骤时的回调（用户点击"下一步"后触发）
   * @param stepIndex 当前步骤索引
   */
  onStepComplete?: (stepIndex: number) => void;
  /**
   * 显示条件，返回 false 则跳过此步骤
   * 用于根据不同环境（如 VSCode/JetBrains）动态过滤步骤
   */
  showWhen?: () => boolean;
}

export interface TourConfig {
  /** 引导唯一标识 */
  id: string;
  /** 引导名称 */
  name: string;
  /** 引导步骤 */
  steps: TourStep[];
  /** 版本号，更新后可重新触发已完成的引导 */
  version?: string;
  /** 自定义样式 */
  styles?: Styles;
  /** 触发配置 */
  trigger?: TourTriggerConfig;
  /**
   * 引导所属的页面路由
   * 当用户切换到其他页面时，引导会被暂停；回到此页面时自动恢复
   * 例如: 'chat' 表示此引导仅在 Chat Tab 下有效
   */
  activePageRoute?: string;
  /**
   * @deprecated 使用 trigger.condition 代替
   * 触发条件，返回 true 时才显示引导
   */
  triggerCondition?: () => boolean;
}