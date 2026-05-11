/**
 * 调试日志工具
 * 支持带颜色的标签、分组展示等功能
 */

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

interface LogStyle {
  background: string;
  color: string;
  padding: string;
  borderRadius: string;
  fontWeight: string;
}

const LOG_STYLES: Record<LogLevel, LogStyle> = {
  info: {
    background: '#2196F3',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
  success: {
    background: '#4CAF50',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
  warn: {
    background: '#FF9800',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
  error: {
    background: '#F44336',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
  debug: {
    background: '#9C27B0',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
};

const MODULE_STYLE: LogStyle = {
  background: '#607D8B',
  color: '#fff',
  padding: '2px 6px',
  borderRadius: '3px',
  fontWeight: 'normal',
};

function styleToString(style: LogStyle): string {
  return `background: ${style.background}; color: ${style.color}; padding: ${style.padding}; border-radius: ${style.borderRadius}; font-weight: ${style.fontWeight}`;
}

/**
 * 带颜色和分组的调试日志
 * @param module 模块名称，如 'onMessage', 'ChatStore'
 * @param message 日志消息
 * @param data 需要展示的数据对象
 * @param level 日志级别，默认 'debug'
 */
export function debugLog(
  module: string,
  message: string,
  data?: Record<string, unknown> | unknown[],
  level: LogLevel = 'debug',
): void {
  const levelStyle = LOG_STYLES[level];
  const levelLabel = level.toUpperCase();

  // 构建格式化的日志标签
  const prefix = `%c${levelLabel}%c %c${module}%c`;
  const styles = [
    styleToString(levelStyle),
    '', // 重置样式
    styleToString(MODULE_STYLE),
    '', // 重置样式
  ];

  if (data && typeof data === 'object') {
    const isArray = Array.isArray(data);
    const entries = isArray ? data : Object.entries(data);
    const hasMultipleEntries = entries.length > 1;

    if (hasMultipleEntries) {
      // 使用 console.group 分组展示多个数据
      console.groupCollapsed(prefix, ...styles, message);
      if (isArray) {
        entries.forEach((item, index) => {
          console.log(`[${index}]`, item);
        });
      } else {
        for (const [key, value] of entries as [string, unknown][]) {
          console.log(`%c${key}:`, 'color: #03A9F4; font-weight: bold', value);
        }
      }
      console.groupEnd();
    } else {
      // 单个数据直接展示
      console.log(prefix, ...styles, message, data);
    }
  } else {
    console.log(prefix, ...styles, message);
  }
}

/**
 * 快捷方法：成功日志
 */
export function debugSuccess(
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  debugLog(module, message, data, 'success');
}

/**
 * 快捷方法：警告日志
 */
export function debugWarn(
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  debugLog(module, message, data, 'warn');
}

/**
 * 快捷方法：错误日志
 */
export function debugError(
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  debugLog(module, message, data, 'error');
}

/**
 * 快捷方法：信息日志
 */
export function debugInfo(
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  debugLog(module, message, data, 'info');
}