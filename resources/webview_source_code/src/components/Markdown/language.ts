/**
 * 由于 highlight.js 定义的 language 不包含非字符串的 characters，而经过 GPT 返回的内容中所定义的 Code Blocks
 * 的语言可能带有非字符串，故需要对其进行转换
 *
 * 譬如我们习惯性的 c++，在 highlight.js 中则是使用 cpp
 *
 * 定义的 language 可参考：https://github.com/highlightjs/highlight.js/tree/main/src/languages
 */
const languageMap = new Map([
  ['c++', 'cpp'],
  ['c#', 'csharp'],
]);

export function getLanguage(originLanguage: string) {
  let actualLanguage = originLanguage;
  if (originLanguage.includes(':')) {
    actualLanguage = originLanguage.split(':')[0];
  }
  const language = languageMap.get(actualLanguage.trim());
  if (!language) {
    return actualLanguage;
  }
  return language;
}

export function getFilePath(originLanguage: string) {
  if (originLanguage.includes(':')) {
    return originLanguage.split(':')[1];
  } else {
    return '';
  }
}
