import { ChatMessage, ChatFeedbackType } from '../../../services';
import { ChatRole } from '../../../types/chat';
import { DocsetMetaWithType, CodeBaseMeta, AttachFile, NetworkModelAttach, MultipleAttach, KnowledgeAugmentationModelAttach } from '../../../services';
import { IRecommendFileChangeRecord } from '../FileRecommendApplyPanel';

export type { ChatMessage, ChatFeedbackType };
export { ChatRole };

export type AttachType = DocsetMetaWithType | CodeBaseMeta | AttachFile | NetworkModelAttach | MultipleAttach | KnowledgeAugmentationModelAttach;

export interface RenderMessage extends ChatMessage {
  messages?: ChatMessage[];
}

export interface ChatMessageProps {
  containerRef?: React.RefObject<HTMLDivElement>;
  onResetPrompt?: (prompt: string) => void;
  userScrollLock?: boolean;
  isShare?: boolean;
  onFeedback?: (feedbackDetail: CodeBaseFeedbackDetail) => void;
  selectedMessageIds?: Set<string>;
  onToggleMessage?: (messageId: string) => void;
}

export interface ChatMessageHandle {
  scrollToPage: (index: number) => void;
  scrollToMessage: (role: string, id: string, keyword: string) => void;
  removeAllHighlights: () => void;
}

export interface CodeBaseFeedbackDetail {
  topic: string;
  chat_type: string;
  chat_repo: string;
  messages: ChatMessage[];
  message_id: string;
  session_id: string;
  feedback: string;
  feedback_type: ChatFeedbackType;
}

export interface ChatUserMessageProps extends ChatMessageProps {
  message: ChatMessage;
  isShare?: boolean;
  selectedMessageIds?: Set<string>;
  onToggleMessage?: (messageId: string) => void;
}

export interface ChatAssistantMessageProps {
  index: number;
  message: ChatMessage;
  isLatest?: boolean;
  isRecent?: boolean;
  attachs: AttachType[];
  onNewSession: (message?: ChatMessage[] | undefined) => void;
  onFeedback: (feedbackType: ChatFeedbackType) => void;
  isShare?: boolean;
  setRecommendFileChanges: (recommendFileChanges: IRecommendFileChangeRecord) => void;
}

export interface ChatToolMessageProps {
  message: ChatMessage;
  isLatest?: boolean;
  isShare?: boolean;
}

export interface GroupAIMessageProps {
  messages: ChatMessage[];
  isLatest?: boolean;
  attachs: AttachType[];
  onFeedback: (feedbackType: ChatFeedbackType) => void;
  isShare?: boolean;
}

export interface ChatCodeBlockProps {
  language: string;
  value: string;
  data: any;
}

export interface FeedbackPanelProps {
  userScrollLock: boolean;
  onCodeBaseFeedback: (feedbackType: ChatFeedbackType) => void;
  submitMessageFeedback: (messageId: string, feedbackType: ChatFeedbackType) => void;
}

export interface ReTryProps {
  userScrollLock: boolean;
}

export interface ToolCallProps {
  message: ChatMessage;
  isShare: boolean;
  isLatest: boolean | undefined;
}

export interface ToolCallResultsProps {
  message: ChatMessage;
  toolResponseDisabled: boolean;
  toolResponse: {
    [propName: string]: boolean;
  };
  unselectedResults: Set<string>;
  handleSelectionChange: (id: string, isSelected: boolean, toolId: string) => void;
  isLatest: boolean | undefined;
}

export interface AskUserQuestionProps {
  toolCallId: string;
  messageId?: string;
  question: string;
  options?: string[];
  multiSelect?: boolean;
  isSubmitted: boolean;
  submittedResult?: string;
}