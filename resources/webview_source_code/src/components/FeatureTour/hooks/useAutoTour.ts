import * as React from 'react';
import { useTourStore } from '../useTourStore';
import { tourRegistry, TourTriggerType } from '../tours';
import EventBus from '../../../utils/eventbus';

/**
 * 自动触发引导的 Hook
 * 根据引导配置自动管理触发逻辑
 */
export function useAutoTour() {
  const { startTour, isTourCompleted, activeTour } = useTourStore();

  /**
   * 尝试触发指定引导
   * 会检查是否已完成，以及自定义条件
   */
  const tryTriggerTour = React.useCallback(
    (tourId: string) => {
      const tour = tourRegistry[tourId];
      if (!tour) {
        console.warn(`[Tour] Tour not found: ${tourId}`);
        return false;
      }

      // 检查是否已完成
      if (isTourCompleted(tourId, tour.version)) {
        return false;
      }

      // 检查是否有其他引导正在进行
      if (activeTour) {
        return false;
      }

      // 检查自定义条件
      const condition = tour.trigger?.condition ?? tour.triggerCondition;
      if (condition && !condition()) {
        return false;
      }

      // 获取延迟时间
      const delay = tour.trigger?.delay ?? 0;

      if (delay > 0) {
        setTimeout(() => {
          // 再次检查状态（防止延迟期间状态变化）
          const currentState = useTourStore.getState();
          if (!currentState.activeTour && !currentState.isTourCompleted(tourId, tour.version)) {
            startTour(tourId);
          }
        }, delay);
      } else {
        startTour(tourId);
      }

      return true;
    },
    [startTour, isTourCompleted, activeTour]
  );

  /**
   * 检查引导是否可以触发（不实际触发）
   */
  const canTriggerTour = React.useCallback(
    (tourId: string) => {
      const tour = tourRegistry[tourId];
      if (!tour) {
        return false;
      }

      // 检查是否已完成
      if (isTourCompleted(tourId, tour.version)) {
        return false;
      }

      // 检查自定义条件
      const condition = tour.trigger?.condition ?? tour.triggerCondition;
      if (condition && !condition()) {
        return false;
      }

      return true;
    },
    [isTourCompleted]
  );

  return {
    tryTriggerTour,
    canTriggerTour,
  };
}

/**
 * 页面入口引导 Hook
 * 在页面加载时自动触发配置的引导
 * 同时处理暂停引导的恢复（当用户回到之前暂停引导的页面时）
 * 支持连续触发：完成一个引导后自动触发下一个
 * @param pageRoute 当前页面路由标识（如 '/chat'）
 */
export function usePageEntryTour(pageRoute: string) {
  const { tryTriggerTour, canTriggerTour } = useAutoTour();
  const triggeredRef = React.useRef(false);
  const hasHydrated = useTourStore((state) => state.hasHydrated);
  const pausedTour = useTourStore((state) => state.pausedTour);
  const resumeTour = useTourStore((state) => state.resumeTour);
  const enqueueTours = useTourStore((state) => state.enqueueTours);
  const clearPendingTours = useTourStore((state) => state.clearPendingTours);

  // 处理暂停引导的恢复
  React.useEffect(() => {
    if (!hasHydrated || !pausedTour) {
      return;
    }

    // 检查暂停的引导是否属于当前页面
    // pageRoute 可能是 '/chat' 格式，activePageRoute 是 'chat' 格式
    const pausedTourConfig = tourRegistry[pausedTour.id];
    const normalizedPageRoute = pageRoute.replace(/^\//, ''); // 移除开头的斜杠
    if (pausedTourConfig?.activePageRoute === normalizedPageRoute) {
      // 延迟恢复，等待 DOM 渲染完成
      const delay = pausedTourConfig.trigger?.delay ?? 300;
      const timer = setTimeout(() => {
        resumeTour();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [hasHydrated, pausedTour, pageRoute, resumeTour]);

  React.useEffect(() => {
    // 等待 hydration 完成后再检查引导
    if (!hasHydrated) {
      return;
    }

    // 防止重复触发
    if (triggeredRef.current) {
      return;
    }

    // 如果有暂停的引导，不要触发新的引导
    if (pausedTour) {
      return;
    }

    // 查找匹配当前页面的引导
    const matchingTours = Object.values(tourRegistry).filter(
      (tour) =>
        tour.trigger?.type === TourTriggerType.PageEnter &&
        tour.trigger.pageRoute === pageRoute
    );

    // 收集所有可触发的引导 ID
    const triggableTourIds = matchingTours
      .filter((tour) => canTriggerTour(tour.id))
      .map((tour) => tour.id);

    if (triggableTourIds.length === 0) {
      return;
    }

    // 将所有可触发的引导加入队列
    clearPendingTours();
    enqueueTours(triggableTourIds);

    // 触发第一个引导
    const firstTourId = triggableTourIds[0];
    if (tryTriggerTour(firstTourId)) {
      triggeredRef.current = true;
    }
  }, [pageRoute, tryTriggerTour, canTriggerTour, hasHydrated, pausedTour, enqueueTours, clearPendingTours]);
}

/**
 * 事件触发引导 Hook
 * 监听指定事件并在事件触发时启动引导
 * @param eventName 要监听的事件名称
 */
export function useEventTriggerTour(eventName: string) {
  const { tryTriggerTour } = useAutoTour();
  const hasHydrated = useTourStore((state) => state.hasHydrated);

  React.useEffect(() => {
    // 等待 hydration 完成后再监听事件
    if (!hasHydrated) {
      return;
    }

    // 查找监听此事件的引导
    const matchingTours = Object.values(tourRegistry).filter(
      (tour) =>
        tour.trigger?.type === TourTriggerType.Event &&
        tour.trigger.eventName === eventName
    );

    if (matchingTours.length === 0) {
      return;
    }

    const handleEvent = () => {
      // 尝试触发第一个匹配的引导
      for (const tour of matchingTours) {
        if (tryTriggerTour(tour.id)) {
          break;
        }
      }
    };

    EventBus.instance.on(eventName, handleEvent);

    return () => {
      EventBus.instance.off(eventName, handleEvent);
    };
  }, [eventName, tryTriggerTour, hasHydrated]);
}

/**
 * 触发引导事件的辅助函数
 * 用于在业务代码中触发事件类型的引导
 */
export function dispatchTourEvent(eventName: string) {
  EventBus.instance.dispatch(eventName);
}