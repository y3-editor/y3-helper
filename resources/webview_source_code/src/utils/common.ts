import { minimatch } from 'minimatch';

export function removeTrailingPunctuation(str: string) {
  const regex = /[.。?？!！]+$/;
  return str.replace(regex, '');
}

/**
 * 处理会话标题：去除末尾标点并限制长度
 * @param topic 原始标题
 * @param maxLength 最大长度，默认 30
 * @returns 处理后的标题
 */
export function truncateSessionTopic(topic: string, maxLength = 30): string {
  if (!topic) return '';
  // 先去除末尾标点
  let result = removeTrailingPunctuation(topic.trim());
  // 限制长度
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + '...';
  }
  return result;
}

export function addObjectHasOwnPolyfill() {
  // 添加 Polyfill
  if (!Object.hasOwn) {
    Object.hasOwn = function (obj, prop) {
      try {
        return Object.prototype.hasOwnProperty.call(obj, prop);
      } catch (error) {
        console.error('Error adding Object.hasOwn polyfill:', error);
        return false;
      }
    };
  }
}

export function addQuotes(input: string) {
  return input.replace(/\[([^\]]+)\]/g, '["$1"]'); // 方括号
}
export function removeUnmatchedBraces(input: string) {
  // Regular expressions to match specific sequences
  const patterns = {
    MARKED1: /\|\|--\|{/g, // To handle `||--|{`
    MARKED2: /}--o{/g, // To handle `}--o{`
    MARKED3: /}o--\|\|/g, // To handle `}o--||`
    MARKED4: /}o--\|{/g, // To handle `}o--|{`
    MARKED5: /}--o\|/g, // To handle `}--o|`
    MARKED6: /}o--{/g, // To handle `}o--{`
    MARKED7: /o--\|{/g, // To handle `o--|{`
    MARKED8: /\|\|--o\{/g, // To handle `||--o{`
    MARKED9: /--\|\{/g, // To handle `--|{`
  };

  // Placeholders for the marked sequences
  const placeholders = {
    MARKED1: '<MARKED1>',
    MARKED2: '<MARKED2>',
    MARKED3: '<MARKED3>',
    MARKED4: '<MARKED4>',
    MARKED5: '<MARKED5>',
    MARKED6: '<MARKED6>',
    MARKED7: '<MARKED7>',
    MARKED8: '<MARKED8>',
    MARKED9: '<MARKED9>',
  };

  // Marking all sequences to prevent them from being modified
  let markedInput = input;

  for (const [key, pattern] of Object.entries(patterns)) {
    const placeholder = placeholders[key as keyof typeof placeholders];
    markedInput = markedInput.replace(pattern, placeholder);
  }

  // Initialize a stack to keep track of matched braces
  const stack: number[] = [];
  let result = '';

  for (let i = 0; i < markedInput.length; i++) {
    const char = markedInput[i];

    const nextPlaceholder = Object.values(placeholders).find(
      (ph) => markedInput.slice(i, i + ph.length) === ph,
    );

    if (nextPlaceholder) {
      result += nextPlaceholder;
      i += nextPlaceholder.length - 1; // Skip the length of the placeholder
      continue;
    }

    if (char === '{') {
      // Push index to stack
      stack.push(result.length);
      result += char;
    } else if (char === '}') {
      // Pop from stack if there is a matching opening brace
      if (stack.length) {
        stack.pop();
        result += char;
      }
    } else {
      result += char;
    }
  }

  // At this point, all unmatched closing braces have been removed.
  // We need to remove unmatched opening braces.
  while (stack.length) {
    const indexToRemove = stack.pop()!;
    result = result.slice(0, indexToRemove) + result.slice(indexToRemove + 1);
  }

  // Restore original sequences
  for (const [key, placeholder] of Object.entries(placeholders)) {
    const originalSeq = patterns[key as keyof typeof patterns].source.replace(
      /[\\()]/g,
      '',
    );
    const regexPlaceholder = new RegExp(placeholder, 'g');
    result = result.replace(regexPlaceholder, originalSeq);
  }

  return result;
}

export const normalizePath = (path: string) => {
  // 使用正则表达式将盘符转换为统一大小写
  return path.replace(/^([a-zA-Z]):/, (_match, p1) => {
    return p1.toUpperCase() + ':';
  });
};
//如果以\结尾，去掉\
export const removeTrailingBackslash = (str: string): string => {
  // 使用正则表达式检查字符串是否以反斜杠结尾
  if (str.match(/\\$/)) {
    // 如果是，返回去掉最后一个字符的字符串
    return str.slice(0, -1);
  }
  // 如果不是，返回原字符串
  return str;
};
//如果以/结尾，去掉/
export const removeTrailingSlash = (str: string): string => {
  // 使用正则表达式检查字符串是否以斜杠结尾
  if (str.match(/\/$/)) {
    // 如果是，返回去掉最后一个字符的字符串
    return str.slice(0, -1);
  }
  // 如果不是，返回原字符串
  return str;
};

// 判断路径是否匹配
export const pathsMatch = (
  tool_result: {
    [propName: string]: {
      path: string;
      content: string;
    };
  },
  codebaseDefaultAuthorizationPath: string[],
) => {
  const allPathsMatch: boolean = Object.values(tool_result).every((item) =>
    codebaseDefaultAuthorizationPath.some((pattern: string) => {
      if (!item.path) {
        return false;
      }
      const trimmedPattern = normalizePath(
        removeTrailingSlash(removeTrailingBackslash(pattern.trim())),
      );
      const trimmedItem = normalizePath(item.path.trim());
      if (trimmedItem.includes(trimmedPattern)) {
        return true;
      } else {
        const formattedPath = trimmedPattern.replace(/\\/g, '\\\\');
        return minimatch(trimmedItem, formattedPath);
      }
    }),
  );
  return allPathsMatch;
};

/**
 * 标准化工作区路径
 * - 统一使用正斜杠
 * - 转换为小写（Windows 路径不区分大小写）
 * - 去除末尾斜杠
 * @param path 工作区路径
 * @returns 标准化后的路径
 */
export function normalizeWorkspacePath(path: string): string {
  if (!path) return '';
  return removeTrailingSlash(path.replace(/\\/g, '/').toLowerCase());
}

/**
 * 判断两个工作区路径是否相同
 * - 忽略大小写和分隔符差异
 * @param path1 路径1
 * @param path2 路径2
 * @returns 是否相同
 */
export function isSameWorkspace(path1?: string, path2?: string): boolean {
  if (!path1 || !path2) return false;
  return normalizeWorkspacePath(path1) === normalizeWorkspacePath(path2);
}

export function versionCompare(_a: string, _b: string) {
  // Y3 集成：功能一旦合入就会生效，无需靠版本号做 gate。
  // 返回 -1 表示「a > b」，调用点形如 versionCompare('26.3.7', v) >= 0 判定
  // 「v >= 26.3.7」时会得到 false → 功能被关。改为恒返 1，让所有版本门永远通过。
  return 1;
}

export function jetbrainsVersionCompare(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  // 处理复杂版本号，将非数字字符替换为点号进行分割
  const normalizeVersion = (version: string): string[] => {
    return version
      .replace(/[^0-9.]/g, '.') // 将非数字非点号字符替换为点号
      .split('.')
      .filter(part => part !== '') // 移除空字符串
      .map(part => part || '0'); // 确保没有空值
  };

  const a_components = normalizeVersion(a);
  const b_components = normalizeVersion(b);
  const maxLen = Math.max(a_components.length, b_components.length);

  // 补齐较短的版本号组件
  for (let i = 0; i < maxLen; i++) {
    const aNum = parseInt(a_components[i] || '0');
    const bNum = parseInt(b_components[i] || '0');

    if (aNum > bNum) {
      return 1;  // a 大于 b
    }
    if (aNum < bNum) {
      return -1; // a 小于 b
    }
  }

  return 0; // 版本相等
}