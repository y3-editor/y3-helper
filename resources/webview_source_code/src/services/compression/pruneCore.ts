import {
  ChatMessage,
  ChatMessageContent,
  type ChatMessageContentText,
  type ChatMessageContentUnion,
} from '../../services';
import { ChatRole } from '../../types/chat';
import { DEFAULT_COMPRESSION_CONFIG } from '../../types/contextCompression';
import { calculateSingleMessageContentTokensAsync } from '../../utils/tokenCalculator';
import { isPersistedToolOutputContent } from '../../utils/toolResultPersistenceConstants';
import { callIDETool } from '../../PostMessageProvider';
import {
  ContentReplacementState,
  getOrCreateReplacementState,
  persistReplacementState,
} from './pruneState';

// Tool output 裁剪相关常量
const PRUNE_PROTECT = 20_000;
const PRUNE_MINIMUM = 10_000;
const PRUNE_PROTECTED_TOOLS = ['use_skill'];
const CLEARED_TOOL_OUTPUT = '[Tool output cleared]';
// 内容太短不值得落盘——<persisted-output> 引用文本约 3500 字符（含 2000 字符 preview），
// 原文必须显著长于引用文本才有落盘价值
const PRUNE_PERSIST_MIN_CHARS = 3500;

/**
 * Full-compact 强制硬墙：当 token 用量达到 compressionThreshold (默认 99%) 时，
 * 任何启发式（包括 prune 救援）都不能阻挡 full-compact，避免饥饿死锁导致 ContextTooLong。
 *
 * 对齐 CC 的 limit - 3000 阻塞硬墙、OpenCode 的 isOverflow 兜底机制。
 * 复用 DEFAULT_COMPRESSION_CONFIG.thresholds.compressionThreshold，不引入新阈值。
 */
export function shouldForceFullCompact(
  currentTokens: number | undefined,
  modelMaxTokens: number | undefined,
): boolean {
  if (
    currentTokens === undefined ||
    modelMaxTokens === undefined ||
    modelMaxTokens <= 0
  ) {
    return false;
  }
  const threshold = DEFAULT_COMPRESSION_CONFIG.thresholds.compressionThreshold;
  return currentTokens >= modelMaxTokens * threshold;
}

/**
 * 预构建 tool_call_id → tool_name 的映射，
 * 避免 pruneToolOutputs 中对每条 tool 消息做 O(n) 反查。
 */
function buildToolCallIdMap(messages: ChatMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role !== ChatRole.Assistant || !msg.tool_calls) continue;
    for (const tc of msg.tool_calls) {
      map.set(tc.id, tc.function.name);
    }
  }
  return map;
}

/** 从 ChatMessage.content 提取纯文本（支持 string 和 ChatMessageContentUnion[] 格式） */
function extractTextContent(content: string | ChatMessageContentUnion[]): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block): block is ChatMessageContentText => block.type === ChatMessageContent.Text)
    .map((block) => block.text)
    .join('\n');
}

/**
 * 通过 IDE 扩展将 tool output 落盘为文件，返回 <persisted-output> 引用文本。
 * 幂等：同一 toolCallId + sessionId → 同一文件路径 → 同一引用文本。
 * 失败时返回 null，调用方 fallback 到 CLEARED_TOOL_OUTPUT。
 */
async function persistToolOutputViaIDE(
  toolCallId: string,
  sessionId: string | undefined,
  content: string,
): Promise<string | null> {
  try {
    const result = await callIDETool(
      'persist_pruned_output',
      {
        tool_call_id: toolCallId,
        session_id: sessionId,
        content,
      },
      15000, // 15s 超时，落盘可能涉及大文件写入
    );
    // callIDETool 在 isError 或无 content 时返回 null
    if (result?.content) {
      return result.content as string;
    }
    return null;
  } catch (e) {
    console.warn('[CompressionService] persistToolOutputViaIDE failed:', e);
    return null;
  }
}

/**
 * 对齐 CC enforceToolResultBudget：收集候选 tool result。
 * 保护区（最近 2 轮 user）内的 tool result 不参与评估。
 */
interface ToolResultCandidate {
  index: number;
  toolUseId: string;
  content: string;
  size: number; // token 估算
}

function collectCandidates(
  messages: ChatMessage[],
  toolNameMap: Map<string, string>,
): ToolResultCandidate[] {
  const candidates: ToolResultCandidate[] = [];
  let turns = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === ChatRole.User) turns++;
    if (turns < 2) continue;
    if (msg.isCompressionSummary) break;
    if (msg.role !== ChatRole.Tool) continue;

    const rawContent = extractTextContent(msg.content);
    if (isPersistedToolOutputContent(rawContent)) continue;

    const toolName = msg.tool_call_id
      ? toolNameMap.get(msg.tool_call_id)
      : undefined;
    if (toolName && PRUNE_PROTECTED_TOOLS.includes(toolName)) continue;

    if (!msg.tool_call_id) continue;

    candidates.push({
      index: i,
      toolUseId: msg.tool_call_id,
      content: rawContent,
      size: 0, // 稍后异步计算
    });
  }

  // 反转回正序（从旧到新）
  candidates.reverse();
  return candidates;
}

/**
 * 对齐 CC selectFreshToReplace：按 size 降序排列，
 * 优先落盘最大的，直到总量降到预算以下。
 */
function selectCandidatesToReplace(
  fresh: ToolResultCandidate[],
  frozenSize: number,
  limit: number,
): ToolResultCandidate[] {
  const sorted = [...fresh].sort((a, b) => b.size - a.size);
  const selected: ToolResultCandidate[] = [];
  let remaining = frozenSize + fresh.reduce((sum, c) => sum + c.size, 0);
  for (const c of sorted) {
    if (remaining <= limit) break;
    selected.push(c);
    remaining -= c.size;
  }
  return selected;
}

/**
 * 对齐 CC enforceToolResultBudget：裁剪旧的 tool message output，减少 token 总量。
 *
 * 核心逻辑对齐 CC 的 ContentReplacementState：
 * - seenIds: 已参与过预算决策的 tool_use_id，后续不可翻案
 * - replacements: 已裁剪的 tool_use_id → 替换文本（缓存，重放时零 I/O，字节一致）
 *
 * 选择策略对齐 CC：按 size 降序，优先落盘最大的。
 *
 * 激进模式：当 currentTokens >= modelMaxTokens * errorThreshold 时，
 * seenIds 中被冻结为"保留"的消息不再受保护，重新参与裁剪决策。
 *
 * 不提供 stateKey 时退化为原始无状态行为（如压缩 fallback 场景）。
 */
export type PruneResult = {
  messages: ChatMessage[];
  /**
   * @deprecated 该字段语义为"frozen + fresh > PRUNE_PROTECT"，
   * 仅表示历史 tool 总量超出预算，不代表"本轮还能裁出空间"。
   * 上层不要再用此字段决定是否触发 full-compact，
   * 请改用 effectivelyPruned 或 shouldForceFullCompact()。
   */
  hasPrunableContent: boolean;
  /**
   * 本轮微压缩是否真正释放了足够多的 token。
   * 满足以下任一条件即为 true：
   *   - 重放（mustReapply）发生（即历史已裁剪在本轮重新生效）
   *   - 本轮新落盘节省的 token ≥ PRUNE_MINIMUM (10k)
   * 当本轮所有候选都"太短跳过"时，此值为 false——
   * 上层可据此判断"裁不动了，应放行 full-compact"，避免饥饿死锁。
   */
  effectivelyPruned: boolean;
  /** 本轮新裁剪节省的 token 数（不含重放） */
  prunedTokens: number;
  /** 本轮发生重放的条数 */
  replayedCount: number;
};

export async function pruneToolOutputs(
  messages: ChatMessage[],
  stateKey?: string,
  currentTokens?: number,
  modelMaxTokens?: number,
): Promise<PruneResult> {
  const toolNameMap = buildToolCallIdMap(messages);
  const state: ContentReplacementState | undefined = stateKey
    ? getOrCreateReplacementState(stateKey)
    : undefined;

  // 激进模式：token 用量接近 errorThreshold，seenIds 不再受保护
  const aggressiveMode =
    currentTokens !== undefined &&
    modelMaxTokens !== undefined &&
    modelMaxTokens > 0 &&
    currentTokens >= modelMaxTokens * DEFAULT_COMPRESSION_CONFIG.thresholds.errorThreshold;

  const tag = '[微压缩]';
  console.debug(tag, `=======会话=${stateKey}, 激进模式=${aggressiveMode}=======`);

  // ── Step 1: 收集候选 ──
  const candidates = collectCandidates(messages, toolNameMap);
  console.debug(tag, `可评估区 tool 消息: ${candidates.length} 条`);

  // ── Step 2: 分区（对齐 CC partitionByPriorDecision） ──
  const mustReapply: (ToolResultCandidate & { replacement: string })[] = [];
  const frozen: ToolResultCandidate[] = [];
  const fresh: ToolResultCandidate[] = [];

  for (const c of candidates) {
    if (state) {
      const replacement = state.replacements.get(c.toolUseId);
      if (replacement !== undefined) {
        mustReapply.push({ ...c, replacement });
        continue;
      }
      // 已冻结的 tool result 默认不再翻案；激进模式下解冻，重新作为 fresh 参与评估
      if (state.seenIds.has(c.toolUseId) && !aggressiveMode) {
        frozen.push(c);
        continue;
      }
    }
    fresh.push(c);
  }

  console.debug(tag, `分区: 重放=${mustReapply.length}, 冻结=${frozen.length}, 新候选=${fresh.length}`);
  if (mustReapply.length > 0) {
    console.debug(tag, `  需重放:`, mustReapply.map((c) => `${c.toolUseId.slice(0, 12)}…`));
  }

  // ── Step 3: 异步计算 fresh 候选的 token 大小 ──
  await Promise.all(
    fresh.map(async (c) => {
      const msg = messages[c.index];
      c.size = await calculateSingleMessageContentTokensAsync(msg);
    }),
  );
  // frozen 候选也需要 size 用于预算计算
  for (const c of frozen) {
    const msg = messages[c.index];
    c.size = await calculateSingleMessageContentTokensAsync(msg);
  }

  // ── Step 4: 选择需要裁剪的候选（对齐 CC selectFreshToReplace） ──
  const frozenSize = frozen.reduce((sum, c) => sum + c.size, 0);
  const freshSize = fresh.reduce((sum, c) => sum + c.size, 0);
  const totalSize = frozenSize + freshSize;
  const selected = selectCandidatesToReplace(fresh, frozenSize, PRUNE_PROTECT);

  console.debug(
    tag,
    `预算: 冻结=${frozenSize}, 新候选=${freshSize}, 合计=${totalSize}, 上限=${PRUNE_PROTECT}, 超预算=${totalSize > PRUNE_PROTECT}`,
  );
  if (fresh.length > 0) {
    console.debug(
      tag,
      `  新候选(按大小降序):`,
      [...fresh].sort((a, b) => b.size - a.size).map((c) => `${c.toolUseId.slice(0, 12)}…(${c.size})`),
    );
  }
  if (selected.length > 0) {
    console.debug(tag, `  选中裁剪:`, selected.map((c) => `${c.toolUseId.slice(0, 12)}…(${c.size})`));
  }

  // 无 stateKey 时需要 PRUNE_MINIMUM 门槛
  const hasNewPrunes = stateKey
    ? selected.length > 0
    : selected.reduce((sum, c) => sum + c.size, 0) >= PRUNE_MINIMUM;

  // ── Step 5: 更新状态（对齐 CC：只有实际裁剪时才更新 seenIds） ──
  const selectedIds = new Set(selected.map((c) => c.toolUseId));

  if (hasNewPrunes && state) {
    const newSeenIds: string[] = [];
    // 未被选中的 fresh 候选 → 冻结为"保留"
    for (const c of fresh) {
      if (!selectedIds.has(c.toolUseId)) {
        state.seenIds.add(c.toolUseId);
        newSeenIds.push(c.toolUseId);
      }
    }
    // 激进模式下，被选中的旧 seenIds 从 seenIds 移除
    const unfrozenIds: string[] = [];
    if (aggressiveMode) {
      for (const c of selected) {
        if (state.seenIds.has(c.toolUseId)) {
          state.seenIds.delete(c.toolUseId);
          unfrozenIds.push(c.toolUseId);
        }
      }
    }
    console.debug(
      tag,
      `状态更新: +冻结保留=${newSeenIds.length}, 解冻裁剪=${unfrozenIds.length}, 总冻结=${state.seenIds.size}, 总替换=${state.replacements.size}`,
    );

    // session key 持久化（fire-and-forget）
    if (stateKey && !stateKey.startsWith('subagent:')) {
      persistReplacementState(stateKey, state);
    }
  }

  // ── Step 6: 判断是否需要执行 ──
  const hasReplay = mustReapply.length > 0;
  // hasPrunableContent: frozen + fresh 总量是否超过预算（仅作历史指标，不再用于决策）
  const hasPrunableContent = frozenSize + freshSize > PRUNE_PROTECT;

  if (!hasReplay && !hasNewPrunes) {
    console.debug(tag, `无需操作: 无重放也无新裁剪, 历史超预算=${hasPrunableContent}`);
    return {
      messages,
      hasPrunableContent,
      effectivelyPruned: false,
      prunedTokens: 0,
      replayedCount: 0,
    };
  }

  // ── Step 7: 落盘 + 构建替换映射 ──
  const replacementMap = new Map<number, string>();

  // 重放：从 replacements 缓存直接取（零 I/O，字节一致）
  for (const c of mustReapply) {
    replacementMap.set(c.index, c.replacement);
  }

  // 新裁剪：落盘并缓存替换文本
  if (hasNewPrunes) {
    let sessionId: string | undefined;
    if (stateKey) {
      sessionId = stateKey.startsWith('subagent:')
        ? stateKey.slice('subagent:'.length)
        : stateKey;
    }

    const persistResults = await Promise.all(
      selected.map(async (c) => {
        if (!c.content || c.content.length < PRUNE_PERSIST_MIN_CHARS) {
          console.debug(
            tag,
            `  跳过(太短,保留原文): ${c.toolUseId.slice(0, 12)}… (${c.content?.length ?? 0}字符)`,
          );
          return { candidate: c, replacement: null as string | null };
        }
        const replacement = await persistToolOutputViaIDE(c.toolUseId, sessionId, c.content);
        if (replacement) {
          console.debug(
            tag,
            `  落盘成功: ${c.toolUseId.slice(0, 12)}… (${c.content.length}字符 → ${replacement.length}字符)`,
          );
        } else {
          console.debug(tag, `  落盘失败,降级为清除: ${c.toolUseId.slice(0, 12)}…`);
        }
        return { candidate: c, replacement: replacement ?? CLEARED_TOOL_OUTPUT };
      }),
    );

    for (const { candidate, replacement } of persistResults) {
      if (replacement === null) continue; // 太短的候选跳过，保留原文
      replacementMap.set(candidate.index, replacement);
      // 缓存替换文本到 state（后续轮次零 I/O 重放）
      if (state) {
        state.replacements.set(candidate.toolUseId, replacement);
        state.seenIds.add(candidate.toolUseId);
      }
    }

    // 持久化更新后的 state
    if (state && !stateKey?.startsWith('subagent:')) {
      persistReplacementState(stateKey!, state);
    }
  }

  // ── Step 8: 构建结果 ──
  const result = messages.map((msg, index) => {
    const replacement = replacementMap.get(index);
    if (replacement === undefined) return msg;
    return { ...msg, content: replacement };
  });

  // 真正写入 replacementMap 的才算"实际节省"——
  // "太短跳过"的候选已被 `if (replacement === null) continue` 排除在外。
  // 这是对齐 CC `MIN_SAVINGS_THRESHOLD` 与 OpenCode `pruned > PRUNE_MINIMUM` 的关键判据。
  const actuallyReplacedIds = new Set(
    selected.filter((c) => replacementMap.has(c.index)).map((c) => c.toolUseId),
  );
  const prunedTokens = selected
    .filter((c) => actuallyReplacedIds.has(c.toolUseId))
    .reduce((sum, c) => sum + c.size, 0);
  const persistedCount = [...replacementMap.values()].filter((r) => r !== CLEARED_TOOL_OUTPUT).length;
  const clearedCount = [...replacementMap.values()].filter((r) => r === CLEARED_TOOL_OUTPUT).length;

  // effectivelyPruned: 本轮是否真正释放了足够多的 token
  // - 重放发生：历史已裁剪的 tool output 在本轮重新生效，等价于持续节省
  // - 新裁剪节省 ≥ PRUNE_MINIMUM：达到 CC/OpenCode 的最小有效门槛
  const effectivelyPruned = hasReplay || prunedTokens >= PRUNE_MINIMUM;

  console.log(
    tag,
    `结果: 重放=${mustReapply.length}, 新裁剪选中=${selected.length}, 实际落盘=${persistedCount}, 清除=${clearedCount}, ` +
      `激进=${aggressiveMode}, 实际节省~${prunedTokens}tokens, 有效裁剪=${effectivelyPruned}, 历史超预算=${hasPrunableContent}`,
  );
  return {
    messages: result,
    hasPrunableContent,
    effectivelyPruned,
    prunedTokens,
    replayedCount: mustReapply.length,
  };
}