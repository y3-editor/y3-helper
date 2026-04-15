import { minimatch } from 'minimatch';

export const CODE_SEARCH_URL =
  'http://localhost:3001';

export const CODE_SEARCH_URL_NEW =
  'http://localhost:3001';

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

export function versionCompare(a: string, b: string) {
  if (a === b) {
    return 0;
  }
  const a_components = a.split('.');
  const b_components = b.split('.');
  const len = Math.min(a_components.length, b_components.length);
  // loop while the components are equal
  for (let i = 0; i < len; i++) {
    // A bigger than B
    if (parseInt(a_components[i]) > parseInt(b_components[i])) {
      return -1;
    }
    // B bigger than A
    if (parseInt(a_components[i]) < parseInt(b_components[i])) {
      return 1;
    }
  }
  // If one's a prefix of the other, the longer one is greater.
  if (a_components.length > b_components.length) {
    return -1;
  }
  if (a_components.length < b_components.length) {
    return 1;
  }
  // Otherwise they are the same.
  return 0;
}