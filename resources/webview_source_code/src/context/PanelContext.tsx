/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { ChatType } from '../store/chat';

/**
 * 面板模式类型
 */
export type PanelMode = 'full' | 'panel' | 'sidebar' | 'newwindow';

/**
 * 面板上下文状态
 */
interface PanelContextState {
  mode: PanelMode;
  panelId?: string;
  isPanelMode: boolean;
  initialChatType?: ChatType;
}

const PanelContext = React.createContext<PanelContextState | undefined>(undefined);

/**
 * 从 URL 解析面板参数
 */
function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const chatTypeParam = urlParams.get('chatType');
  const mode = urlParams.get('mode') || 'full';
  const panelId = urlParams.get('panelId');
  
  return {
    mode: (mode as PanelMode) || 'full',
    panelId: panelId || undefined,
    chatType: (chatTypeParam === 'default' || chatTypeParam === 'codebase')
      ? chatTypeParam as ChatType
      : undefined,
  };
}

interface PanelProviderProps {
  children: React.ReactNode;
}

/**
 * 面板上下文 Provider
 * 管理面板模式相关的状态
 */
export function PanelProvider({ children }: PanelProviderProps) {
  const params = React.useMemo(() => parseUrlParams(), []);

  const value = React.useMemo<PanelContextState>(() => ({
    mode: params.mode,
    panelId: params.panelId,
    isPanelMode: params.mode === 'panel',
    initialChatType: params.chatType,
  }), [params.mode, params.panelId, params.chatType]);

  return (
    <PanelContext.Provider value={value}>
      {children}
    </PanelContext.Provider>
  );
}

/**
 * 获取面板上下文
 */
export function usePanelContext(): PanelContextState {
  const context = React.useContext(PanelContext);
  if (context === undefined) {
    throw new Error('usePanelContext must be used within a PanelProvider');
  }
  return context;
}

/**
 * 检查是否在 PanelProvider 内
 */
export function usePanelContextOptional(): PanelContextState | undefined {
  return React.useContext(PanelContext);
}

export default PanelContext;
