// ⚠️ 此文件已重构拆分到 services/compression/ 目录，保留为兼容性入口。
// 新代码请直接 import from '../services/compression'。
//
// 拆分映射：
//   sessionStatus.ts  → 压缩状态机
//   pruneState.ts     → ContentReplacementState 跨轮次状态读写
//   pruneCore.ts      → 微压缩算法 + 硬墙判断
//   fullCompact.ts    → CompressionService 全量压缩 LLM 流程
export * from './compression';

// Dev-only：保留 HEAD 版本暴露给浏览器 console 的调试入口
if (process.env.NODE_ENV === 'development') {
  // 动态 import 避免循环依赖问题
  void import('./compression/pruneCore').then(({ pruneToolOutputs }) => {
    void import('./compression/pruneState').then(
      ({ clearPruneState, _devGetReplacementStates }) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.compressionService = {
          pruneToolOutputs,
          clearPruneState,
          get _pruneReplacementState() {
            return _devGetReplacementStates();
          },
        };
      },
    );
  });
}