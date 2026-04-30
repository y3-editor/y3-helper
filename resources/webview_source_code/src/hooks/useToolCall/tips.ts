/**
 * 自动配置提示文本生成逻辑
 */

import { useMemo, useCallback } from 'react';
import { usePostMessage } from '../../PostMessageProvider';
import { AutoConfigTips } from './types';

export function useConfigTips(): AutoConfigTips {
  const { postMessage } = usePostMessage();

  const openExtensionSetting = useCallback(() => {
    postMessage({
      type: 'OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH',
    });
  }, [postMessage]);

  const autoApproveTip = useMemo(() => {
    return '开启后，智聊过程将自动进行目录/文件授权，可通过配置忽略目录来保护敏感文件。';
  }, []);

  const autoApplyTip = useMemo(() => {
    return '开启后，智聊过程的代码修改将自动应用，可通过消息回撤来恢复变更。';
  }, []);

  const autoExecuteTip = useMemo(() => {
    return '开启后，智聊过程需运行的命令将自动执行，可通过配置忽略命令来规避高危操作。';
  }, []);

  const autoTodoTip = useMemo(() => {
    return '开启后，智聊过程生成的plan执行过程全自动，无需手动确认';
  }, []);

  return {
    autoApproveTip,
    autoApplyTip,
    autoExecuteTip,
    autoTodoTip,
    openExtensionSetting,
  };
}