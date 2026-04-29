import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 获取工作区根路径
 * - 如果是多根工作区（.code-workspace），且所有 folders 都与
 *   .code-workspace 文件在同一层（即 folder 的父目录就是
 *   .code-workspace 所在目录），则返回该目录
 * - 否则回退到 workspaceFolders[0]
 * - 都没有则返回空字符串
 */
export function getWorkspaceRootPath(): string {
  const folders = vscode.workspace.workspaceFolders;

  // 判断是否为多根工作区 (.code-workspace)
  const workspaceFile = vscode.workspace.workspaceFile;
  if (workspaceFile && workspaceFile.scheme === 'file' && folders && folders.length > 0) {
    const workspaceDir = path.dirname(workspaceFile.fsPath);
    const normalizedDir = workspaceDir.replace(/\\/g, '/').toLowerCase();
    // 检查所有 folders 是否都与 .code-workspace 在同一层
    const allSameLevel = folders.every((folder) => {
      const folderParent = path.dirname(folder.uri.fsPath)
        .replace(/\\/g, '/')
        .toLowerCase();
      return folderParent === normalizedDir;
    });
    if (allSameLevel) {
      return workspaceDir;
    }
  }

  // 回退到第一个文件夹
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return '';
}
