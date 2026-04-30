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
  /** 收藏模式下，记录每轮选中了工具调用的 user message id 集合 */
  toolCallRoundIds?: Set<string>;
  /** 收藏模式下，切换某一轮工具调用的选中状态 */
  onToggleToolCallRound?: (userMsgId: string) => void;
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
  /** 收藏模式下隐藏工具调用 UI，工具调用在外部聚合框单独渲染 */
  hideToolCalls?: boolean;
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
  /** 用户发送消息的时间戳（ms） */
  sentAt?: number;
  /** AI 回复完成的时间戳（ms），用于计算耗时 */
  completedAt?: number;
    /** 收藏模式：该轮对应的 user message id */
  userMsgId?: string;
  /** 收藏模式：该轮工具调用是否被选中 */
  isToolCallSelected?: boolean;
  /** 收藏模式：切换该轮工具调用的选中状态 */
  onToggleToolCallRound?: (userMsgId: string) => void;
  /** 收藏模式：该轮对应的 user message 是否已被选中 */
  isUserMsgSelected?: boolean;
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