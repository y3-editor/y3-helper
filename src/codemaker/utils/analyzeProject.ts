/**
 * analyzeProject 精简版 — 仅提供 grepSearch 需要的 getDirsToIgnore 和 PROTECTED_HIDDEN_DIRS
 * 移植自上游 codestream-vscode-extension src/utils/analyzeProject/index.ts
 */

export const PROTECTED_HIDDEN_DIRS = ['.codemaker', '.claude', '.specify', '.opencode'];

/**
 * 获取需要忽略的目录 glob 模式列表
 * Y3 版本：从 VSCode 配置读取 CodeMaker.CodebaseDefaultIgnorePath
 */
const getDirsToIgnore = (): string[] => {
  try {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('CodeMaker');
    const dirsToIgnore = (config.get('CodebaseDefaultIgnorePath') || []) as string[];
    return dirsToIgnore.map((dir: string) => dir.replace(/\\/g, '/').trim());
  } catch {
    return [];
  }
};

export { getDirsToIgnore };
