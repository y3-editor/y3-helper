import * as React from 'react';
import { SubmitKey, useConfigStore } from '../store/config';
import { isMacOS } from '../utils';

function useSubmitHandler() {
  const submitKey = useConfigStore((state) => state.config.submitKey);

  const shouldSubmit = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return false;

    // 在输入法组合状态下，Enter 应该是确认输入法输入，而不是发送消息
    if (e.nativeEvent.isComposing) return false;
    
    // 当设置为 Enter 发送时，Ctrl+Enter (Windows/Linux) 或 Cmd+Enter (Mac) 应该换行而不是发送
    if (submitKey === SubmitKey.Enter) {
      if (isMacOS()) {
        // Mac 上使用 Cmd+Enter 换行
        if (e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          return false;
        }
      } else {
        // Windows/Linux 上使用 Ctrl+Enter 换行
        if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          return false;
        }
      }
    }
    
    return (
      (submitKey === SubmitKey.AltEnter && e.altKey) ||
      (submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return { shouldSubmit };
}

export default useSubmitHandler;