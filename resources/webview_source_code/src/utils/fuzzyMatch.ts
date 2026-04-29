/**
 * 模糊匹配工具函数
 * 基于 workspaceTracker 的 normalize 搜索方式
 */

/**
 * 归一化字符串：转为小写并移除分隔符
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[_\-./\\s]/g, '');
}

/**
 * 将路径分割成单词（基于分隔符和驼峰命名）
 */
function splitIntoWords(str: string): string[] {
  // 先按分隔符分割
  const parts = str.split(/[_\-./\\s]+/);
  const words: string[] = [];

  // 再处理驼峰命名
  for (const part of parts) {
    if (!part) continue;
    // 匹配驼峰分词：contextView -> context, View
    const camelWords = part.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    words.push(...camelWords.filter(w => w.length > 0));
  }

  return words.map(w => w.toLowerCase());
}

/**
 * 模糊匹配算法
 * @param query 查询字符串
 * @param target 目标字符串
 * @returns 匹配结果和分数
 */
export function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const nq = normalize(query);
  const nt = normalize(target);

  // 1. 精确子串匹配（最高分）
  if (t.includes(q)) {
    const index = t.indexOf(q);
    // 位置越靠前得分越高
    const positionBonus = Math.max(0, 20 - index);
    return { match: true, score: 100 + positionBonus };
  }

  // 2. 去分隔符子串匹配
  if (nt.includes(nq)) {
    const index = nt.indexOf(nq);
    const positionBonus = Math.max(0, 15 - index);
    return { match: true, score: 80 + positionBonus };
  }

  // 3. 单词边界匹配（例如：contextview 匹配 context_view）
  const words = splitIntoWords(target);
  const normalizedWords = words.map(w => normalize(w));

  // 3.1 检查是否匹配单个完整单词
  for (let i = 0; i < words.length; i++) {
    if (words[i] === q || normalizedWords[i] === nq) {
      return { match: true, score: 75 };
    }
  }

  // 3.2 检查是否匹配连续单词组合（例如：contextview 匹配 context + view）
  const joinedWords = normalizedWords.join('');
  if (joinedWords.includes(nq)) {
    // 检查查询词是否跨越多个单词
    let currentPos = 0;
    let matchedWords = 0;
    for (const word of normalizedWords) {
      const wordInQuery = nq.substring(currentPos, currentPos + word.length);
      if (word === wordInQuery) {
        currentPos += word.length;
        matchedWords++;
      }
      if (currentPos >= nq.length) break;
    }
    if (currentPos >= nq.length && matchedWords > 1) {
      // 跨越多个单词的匹配
      return { match: true, score: 70 };
    }
  }

  // 4. 首字母缩写匹配（例如：cv 匹配 context_view）
  const initials = words.map(w => w[0]).join('');
  if (initials.includes(q)) {
    return { match: true, score: 60 };
  }

  // 5. 子序列匹配（字符按顺序出现即可）
  let qi = 0;
  let lastMatchIndex = -1;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;

  for (let ti = 0; ti < nt.length && qi < nq.length; ti++) {
    if (nq[qi] === nt[ti]) {
      if (ti === lastMatchIndex + 1) {
        consecutiveMatches++;
      } else {
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
        consecutiveMatches = 1;
      }
      lastMatchIndex = ti;
      qi++;
    }
  }
  maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);

  if (qi === nq.length) {
    // 连续匹配字符越多，得分越高
    const continuityBonus = Math.min(20, maxConsecutive * 2);
    return { match: true, score: 40 + continuityBonus };
  }

  return { match: false, score: 0 };
}

/**
 * 对列表进行模糊匹配并按分数排序
 * @param items 待搜索的项目列表
 * @param keyword 搜索关键词
 * @param getLabel 获取项目标签的函数
 * @returns 按匹配分数排序的项目列表（包含分数）
 */
export function fuzzySearch<T>(
  items: T[],
  keyword: string,
  getLabel: (item: T) => string
): Array<T & { _matchScore?: number }> {
  if (!keyword) {
    return items.map(item => ({ ...item, _matchScore: 0 }));
  }

  const matchedItems = items
    .map(item => {
      const label = getLabel(item);
      const fuzzyResult = fuzzyMatch(keyword, label);
      if (!fuzzyResult.match) {
        return null;
      }
      return { ...item, _matchScore: fuzzyResult.score };
    })
    .filter((item): item is T & { _matchScore: number } => item !== null)
    .sort((a, b) => b._matchScore - a._matchScore);

  return matchedItems;
}
