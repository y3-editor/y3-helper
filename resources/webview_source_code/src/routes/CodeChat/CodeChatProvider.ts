import * as React from 'react';
import { ChatMessageHandle } from './ChatMessagesList';

export interface CodeChatContextType {
  chatMessagesRef: React.MutableRefObject<ChatMessageHandle | null>;
  chatContextRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const CodeChatContext = React.createContext<CodeChatContextType | null>(
  null,
);

export const useCodeChatContext = () => {
  const context = React.useContext(CodeChatContext);
  if (!context) {
    throw new Error('useCodeChatContext must be used within CodeChatProvider');
  }
  return context;
};
