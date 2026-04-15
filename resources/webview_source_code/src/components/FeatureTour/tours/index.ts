import { chatEntryTour } from './chatEntryTour';
import { codebaseSpecTour } from './codebaseSpecTour';
import { devKnowledgeTour } from './devKnowledgeTour';
import { parallelSessionTour } from './parallelSessionTour';
import type { TourConfig } from './types';

export * from './types';
export { chatEntryTour } from './chatEntryTour';
export { codebaseSpecTour, CODEBASE_SESSION_CREATED_EVENT } from './codebaseSpecTour';
export { devKnowledgeTour } from './devKnowledgeTour';
export { parallelSessionTour } from './parallelSessionTour';

/** 所有引导配置的注册表 */
export const tourRegistry: Record<string, TourConfig> = {
  [chatEntryTour.id]: chatEntryTour,
  [codebaseSpecTour.id]: codebaseSpecTour,
  [devKnowledgeTour.id]: devKnowledgeTour,
  [parallelSessionTour.id]: parallelSessionTour,
};

/** 获取所有自动触发类型的引导 */
export function getAutoTriggerTours(): TourConfig[] {
  return Object.values(tourRegistry).filter(
    (tour) => tour.trigger && tour.trigger.type !== 'manual'
  );
}