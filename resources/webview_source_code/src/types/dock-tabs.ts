import type { ReactNode, Ref, ForwardRefExoticComponent, RefAttributes } from 'react';
import type { IconType } from 'react-icons';

export type DockTabActionCtx = {
  activeKey: string;
  apiMap: Record<string, unknown>; // 由容器维护的实例映射
  updateId: number;
};

export type DockTabHelpers = {
  setActions: (node: ReactNode) => void;
  triggerUpdate: () => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

export type DockTabComponent<TApi = unknown> = ForwardRefExoticComponent<
  DockTabHelpers & RefAttributes<TApi>
>;

export type DockTabRender<TApi = unknown> = (
  ref: Ref<TApi>,
  helpers: DockTabHelpers,
) => ReactNode;

export type DockTabItem<TApi = unknown> = {
  key: string;
  icon?: IconType;
  title?: string | ReactNode;
  tooltip?: string;
  // 渲染内容：可以是函数或组件
  render:
  | DockTabRender<TApi>
  | DockTabComponent<TApi>;
  // 右侧操作：根据当前激活项可拿到 apiMap 调用方法
  actions?: (ctx: DockTabActionCtx) => ReactNode;
  // 外部可见性判定
  isVisible?: () => boolean;
  // 锁定状态判定：返回true时禁止切换到其他tab和折叠  
  isLocked?: (ctx: DockTabActionCtx) => boolean;
};


