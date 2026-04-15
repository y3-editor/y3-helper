/**
 * Stub for @dep305/codemaker-web-tools
 * Replaces the internal logging/tracking library with no-op implementations.
 */

const noopScope = {
  setExtra: (..._args: unknown[]) => {},
  setExtras: (..._args: unknown[]) => {},
  setTag: (..._args: unknown[]) => {},
  setContext: (..._args: unknown[]) => {},
  mergeContext: (..._args: unknown[]) => {},
};

export const logger = {
  captureException: (error: unknown) => {
    console.error('[codemaker-tools] Exception:', error);
  },
  captureMessage: (message: string) => {
    console.log('[codemaker-tools] Message:', message);
  },
  hub: {
    withScope: (callback: (scope: typeof noopScope) => void) => callback(noopScope),
  },
};

export const hub = {
  withScope: (callback: (scope: typeof noopScope) => void) => callback(noopScope),
  configureScope: (callback: (scope: typeof noopScope) => void) => callback(noopScope),
};

export const updateContexts = (_context: Record<string, unknown>) => {};

export const patchAxios = {
  patchAxiosCreate: () => {},
};

export const addVSCShortcutListener = () => {};
export const patchConsoleError = () => {};
export const patchConsoleWarn = () => {};
export const patchOnError = () => {};

export default {
  logger,
  hub,
  updateContexts,
  patchAxios,
  addVSCShortcutListener,
  patchConsoleError,
  patchConsoleWarn,
  patchOnError,
};
