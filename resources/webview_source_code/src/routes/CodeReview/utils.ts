/**
 * Y3 精简版 CodeReview/utils.ts
 * 
 * 上游的完整 utils.ts 包含大量 CodeReview 业务函数和依赖（如 proxyRequest, TEAM_REVIEW_API_URL），
 * Y3 没有 CodeReview 模块，但其他文件（如 useChatStream.ts）会 import 此文件中的工具函数。
 * 
 * 本文件只保留被外部引用的通用工具函数，保持 import 路径兼容。
 * 当上游在此文件新增被引用的导出时，需要同步到这里。
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 根据 Tailwind CSS 的优先级规则，自动处理重复或冲突的类名
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

/**
 * 执行函数时，忽略异常
 */
export const execFuncWithoutException = (func: () => void) => {
  try {
    func?.();
  } catch (e) {
    /* empty */
  }
};
