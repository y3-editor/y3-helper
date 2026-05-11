/**
 * ⚠️ DEPRECATED - Minimal Event Store Stub
 * 
 * This file exists ONLY for backward compatibility with legacy components.
 * The event system has been completely removed - all emitEvent() calls have been
 * deleted from lifecycle hooks and manager files.
 * 
 * This stub provides an empty event store so that legacy UI components don't break.
 * 
 * @deprecated Will be removed once TaskDetailModal migrates to session-based timeline
 * 
 * Remaining consumers:
 * - src/components/SubagentDebugPanel/index.tsx (commented out, will be deleted)
 * - src/routes/CodeChat/ChatMessagesList/ToolCallCard/TaskDetailModal.tsx
 *   (ActiveTimeline shows "Waiting for events..." with empty array)
 * 
 * Migration path:
 * - Use `useSubagentStore().sessions.get(taskId)?.messages` for timeline display
 * - Use `useSubagentStore().statuses[toolCallId]` for status display
 */

import { create } from 'zustand';
import type { SubagentEvent } from '../types';

/**
 * Empty event store - always returns []
 * @deprecated
 */
export const useSubagentEventStore = create<{ events: SubagentEvent[] }>(() => ({
  events: [],
}));

/**
 * No-op function - kept for import compatibility only, never actually called
 * All emitEvent() calls have been removed from the codebase
 * @deprecated
 */
export function emitEvent(): void {
  // No-op stub
}