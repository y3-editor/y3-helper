import { getIgnoreHandler } from './handlers/ignoreHandler';

/**
 * 将 .y3makerignore 配置状态同步给 webview。
 *
 * 推送消息类型：SYNC_Y3MAKERIGNORE_STATE
 * 数据：
 *  - hasConfig: 是否存在 .y3makerignore 配置文件
 *  - rules: 当前有效的忽略规则列表
 */
export function syncIgnoreState(): void {
  // 延迟引入避免循环依赖
  const { webviewProvider } = require('./index');
  if (!webviewProvider) {
    return;
  }

  const ignoreHandler = getIgnoreHandler();
  const hasConfig = ignoreHandler?.hasIgnoreConfig() ?? false;
  const rules = ignoreHandler?.getRules() ?? [];

  webviewProvider.sendMessage({
    type: 'SYNC_Y3MAKERIGNORE_STATE',
    data: {
      hasConfig,
      rules,
    },
  });
}
