import { SearchResultNew } from '../services/search';
const keywords = ['参考', '搜索', '检索', '查找'];
export function getSearchSegment(input: string): string | null {
  // const keywords = ['参考', '搜索', '检索', '查找'];

  // 使用逗号和句号进行分割
  const sentences = input.split(/[\u3002\uFF0C]/);

  let searchSegment = null;
  for (const sentence of sentences) {
    // 在每个子句中根据空格进行切分
    const segments = sentence.split(/\s+/);

    for (let i = 0; i < segments.length; i++) {
      if (keywords.some((keyword) => segments[i].includes(keyword))) {
        if (segments[i].length < 4) {
          searchSegment =
            segments[i] + (segments[i + 1] ? ' ' + segments[i + 1] : '');
        } else {
          searchSegment = segments[i];
        }
        break;
      }
    }

    if (searchSegment) break; // 如果已经找到符合条件的片段，就不再处理后面的子句
  }

  return searchSegment;
}
export function removeKeywords(input: string | null): string | null {
  if (!input) {
    return null;
  }
  for (const keyword of keywords) {
    // 关键字一般都是在开头出现
    if (input.startsWith(keyword)) {
      return input.slice(keyword.length);
    }
  }

  return input;
}
export function concatenatePrompt(data: SearchResultNew[]) {
  // 无参考代码，则不需要拼接
  if (!data.length) return '';
  const codeSnippets = data
    .map(
      (item, index) =>
        `代码片段${index + 1}\n 文件名: ${item.language}\n\`\`\`\n${item.code}\n\`\`\``,
    )
    .join('\n\n');
  return `请从以下参考代码片段中选出最相关的一份，结合该代码片段生成回复，可以参考的代码片段有：\n\n${codeSnippets}`;
}

export function formatSearchCode(username: string) {
  return `codesearch_${username.replace(/\./g, '_')}_test`;
}
