import { ChatMessage } from '../services';
import { ChatModel } from '../services/chatModel';


export interface CompressionThresholds {
  warningThreshold: number;      // 60% - 0.6
  errorThreshold: number;        // 80% - 0.8
  compressionThreshold: number;  // 92% - 0.92
}

export interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface CompressionMetadata {
  originalMessageCount: number;
  compressedAt: number;
  tokensSaved: number;
  compressionRatio: number;
  originalTokenCount: number;
  compressedTokenCount: number;
}

export interface CompressedResult extends ChatMessage {
  compressionMetadata: CompressionMetadata;
}

export interface ContextAnalysis {
  currentTokenUsage: number;
  maxTokenLimit: number;
  percentageUsed: number;
  isAboveWarningThreshold: boolean;
  isAboveErrorThreshold: boolean;
  isAboveCompressionThreshold: boolean;
  shouldCompress: boolean;
}

export interface CompressionResult {
  success: boolean;
  compressedResult?: CompressedResult;
  error?: string;
  originalMessageCount: number;
  tokensBeforeCompression: number;
  tokensAfterCompression: number;
  preserveRecentCount?: number;
  compressedMessages?: ChatMessage[];
  uncompressedMessages?: ChatMessage[];
}

export interface CompressionConfig {
  thresholds: CompressionThresholds;
  maxOutputTokens: number;        // 16384
  compressionModel: ChatModel;       // Model to use for compression
  enabled: boolean;
  maxTokens: number;
}

export interface CompressionContext {
  messages: ChatMessage[];
  sessionId: string;
  model?: ChatModel;
  preserveRecentCount?: number;  // How many recent messages to keep uncompressed
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  thresholds: {
    warningThreshold: 0.6,
    errorThreshold: 0.8,
    compressionThreshold: 0.92,
  },
  maxOutputTokens: 16384,
  compressionModel: ChatModel.Gemini3Flash, // Default model for compression
  enabled: true,
  maxTokens: 700_000,
};

export const COMPRESSION_CONSTANTS = {
  PRESERVE_RECENT_MESSAGES: 0,  // Keep last 5 messages uncompressed
  MIN_MESSAGES_TO_COMPRESS: 10, // Don't compress if less than 10 messages
} as const;

// Session-level compression state to be embedded in ChatSession.data
export interface SessionCompressionState {
  enabled: boolean;
  lastAnalysis?: ContextAnalysis;
  compressionHistory: CompressionHistory[];
  totalTokensSaved: number;
  totalCompressionsCount: number;
  pendingSavedTokens?: number;
  messagesCountAtCompression?: number;
  compressSessionStatus?: SessionStatus;
  prevCompressSessionStatus?: SessionStatus;
  statusChangedTime?: number;    // 状态变更时间戳，用于超时检测和冷却计时
}

// Track compression events for analytics
export interface CompressionHistory {
  timestamp: number;
  originalMessageCount: number;
  tokensSaved: number;
  compressionRatio: number;
}

export enum SessionStatus {
  INITIAL = 'initial',
  COMPRESSING = 'compressing',
  COMPRESSED = 'compressed',
  FAILED = 'failed',
}
