import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CompletedTour {
  id: string;
  version?: string;
  completedAt: number;
}

/** 暂停的引导信息 */
interface PausedTour {
  /** 引导 ID */
  id: string;
  /** 暂停时的步骤索引 */
  stepIndex: number;
}

interface TourState {
  /** 当前激活的引导 ID */
  activeTour: string | null;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 已完成的引导列表 */
  completedTours: CompletedTour[];
  /** 暂停的引导（用于 Tab 切换恢复） */
  pausedTour: PausedTour | null;
  /** 待触发的引导队列（用于连续触发） */
  pendingTours: string[];
  /** Hydration 是否完成 */
  hasHydrated: boolean;
  /** 启动指定引导 */
  startTour: (tourId: string) => void;
  /** 停止当前引导 */
  stopTour: () => void;
  /** 暂停当前引导（可恢复） */
  pauseTour: () => void;
  /** 恢复暂停的引导 */
  resumeTour: () => void;
  /** 设置当前步骤索引 */
  setStepIndex: (index: number) => void;
  /** 标记引导完成 */
  completeTour: (tourId: string, version?: string) => void;
  /** 重置引导（允许用户重新查看） */
  resetTour: (tourId: string) => void;
  /** 检查引导是否已完成 */
  isTourCompleted: (tourId: string, version?: string) => boolean;
  /** 设置 hydration 状态 */
  setHasHydrated: (state: boolean) => void;
  /** 添加引导到待触发队列 */
  enqueueTour: (tourId: string) => void;
  /** 添加多个引导到待触发队列 */
  enqueueTours: (tourIds: string[]) => void;
  /** 清空待触发队列 */
  clearPendingTours: () => void;
  /** 触发队列中的下一个引导 */
  triggerNextPendingTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      activeTour: null,
      currentStepIndex: 0,
      completedTours: [],
      pausedTour: null,
      pendingTours: [],
      hasHydrated: false,

      startTour: (tourId) => {
        set({ activeTour: tourId, currentStepIndex: 0, pausedTour: null });
      },

      stopTour: () => {
        set({ activeTour: null, currentStepIndex: 0, pausedTour: null });
      },

      pauseTour: () => {
        const { activeTour, currentStepIndex } = get();
        if (activeTour) {
          set({
            pausedTour: { id: activeTour, stepIndex: currentStepIndex },
            activeTour: null,
            currentStepIndex: 0,
          });
        }
      },

      resumeTour: () => {
        const { pausedTour } = get();
        if (pausedTour) {
          set({
            activeTour: pausedTour.id,
            currentStepIndex: pausedTour.stepIndex,
            pausedTour: null,
          });
        }
      },

      setStepIndex: (index) => {
        set({ currentStepIndex: index });
      },

      completeTour: (tourId, version) => {
        const { completedTours, pendingTours } = get();
        const filtered = completedTours.filter((t) => t.id !== tourId);
        
        // 从待触发队列中移除已完成的引导
        const updatedPendingTours = pendingTours.filter((id) => id !== tourId);
        
        set({
          activeTour: null,
          currentStepIndex: 0,
          completedTours: [
            ...filtered,
            { id: tourId, version, completedAt: Date.now() },
          ],
          pendingTours: updatedPendingTours,
        });

        // 延迟触发下一个队列中的引导
        if (updatedPendingTours.length > 0) {
          setTimeout(() => {
            get().triggerNextPendingTour();
          }, 300);
        }
      },

      resetTour: (tourId) => {
        const { completedTours } = get();
        set({
          completedTours: completedTours.filter((t) => t.id !== tourId),
        });
      },

      isTourCompleted: (tourId, version) => {
        const { completedTours } = get();
        const completed = completedTours.find((t) => t.id === tourId);
        if (!completed) return false;
        // 如果指定了版本，检查版本是否匹配
        if (version && completed.version !== version) return false;
        return true;
      },

      setHasHydrated: (state) => {
        set({ hasHydrated: state });
      },

      enqueueTour: (tourId) => {
        const { pendingTours } = get();
        // 避免重复添加
        if (!pendingTours.includes(tourId)) {
          set({ pendingTours: [...pendingTours, tourId] });
        }
      },

      enqueueTours: (tourIds) => {
        const { pendingTours } = get();
        const newTours = tourIds.filter((id) => !pendingTours.includes(id));
        if (newTours.length > 0) {
          set({ pendingTours: [...pendingTours, ...newTours] });
        }
      },

      clearPendingTours: () => {
        set({ pendingTours: [] });
      },

      triggerNextPendingTour: () => {
        const { pendingTours, activeTour, isTourCompleted } = get();
        
        // 如果有正在进行的引导，不触发
        if (activeTour) {
          return;
        }

        // 找到第一个未完成的引导
        const nextTourId = pendingTours.find((id) => !isTourCompleted(id));
        if (nextTourId) {
          set({
            activeTour: nextTourId,
            currentStepIndex: 0,
            pausedTour: null,
          });
        }
      },
    }),
    {
      name: 'feature-tour-store',
      storage: createJSONStorage(() => localStorage),
      // 只持久化已完成的引导列表
      partialize: (state) => ({
        completedTours: state.completedTours,
      }),
      onRehydrateStorage: () => {
        return () => {
          // 使用 setTimeout 确保 store 完全初始化后再设置 hydration 状态
          setTimeout(() => {
            useTourStore.setState({ hasHydrated: true });
          }, 0);
        };
      },
    }
  )
);