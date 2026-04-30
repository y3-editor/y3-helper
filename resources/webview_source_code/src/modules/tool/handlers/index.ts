/**
 * Handler 注册表
 *
 * 在模块加载时将所有内置 handler 注册到全局 toolResultProcessor 单例。
 * 注意：此文件由 src/modules/tool/index.ts 导入，无需手动调用。
 *
 * 注册顺序：
 * 1. 先设置 DefaultHandler（兜底）
 * 2. 再注册各专用 handler（覆盖对应 toolNames）
 */

import { toolResultProcessor } from '../processor';
import { defaultHandler } from './default';
import { readFileHandler } from './read-file';
import { editFileHandler } from './edit-file';
import { retrieveHandler } from './retrieve';

/**
 * 注册所有内置 handler 到 toolResultProcessor
 */
export function registerBuiltinHandlers(): void {
  // 1. 设置兜底 DefaultHandler
  toolResultProcessor.setDefaultHandler(defaultHandler);

  // 2. 专用 handler
  toolResultProcessor.register(readFileHandler);
  toolResultProcessor.register(editFileHandler);
  toolResultProcessor.register(retrieveHandler);
}