// Compression module - 微压缩 + 全量压缩 + 状态机
//
// 模块职责拆分：
//   sessionStatus.ts  压缩状态机（status get/set/subscribe + 超时/冷却）
//   pruneState.ts     ContentReplacementState 跨轮次状态读写
//   pruneCore.ts      微压缩算法 (pruneToolOutputs) + 硬墙判断 (shouldForceFullCompact)
//   fullCompact.ts    CompressionService 全量压缩 LLM 流程
//
// 此 index 仅做 re-export，保持 services/compressionService.ts 旧路径的 API 兼容。

export {
  getCompressSessionStatus,
  getPrevCompressSessionStatus,
  setCompressSessionStatus,
  subscribeCompressStatus,
} from './sessionStatus';

export { clearPruneState } from './pruneState';

export {
  pruneToolOutputs,
  shouldForceFullCompact,
  type PruneResult,
} from './pruneCore';

export { CompressionService, compressionService } from './fullCompact';