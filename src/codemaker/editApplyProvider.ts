/**
 * EditApplyProvider — 对齐上游 src/provider/editApplyProvider.ts
 *
 * Y3Helper 适配：
 *   - 去掉 reporter 上报
 *   - 去掉 iconv-lite 编码处理（Y3 只用 UTF-8）
 *   - createWorkspaceFile / removeWorkspaceFile → fs 直接操作
 *   - getWorkspaceAbsolutePath → resolveWorkspacePath
 *   - printLog → console.log
 *   - getLanguageIdByFileName → 内联 getLanguageId
 *   - updateDocumentContent → workspace.applyEdit
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { resolveWorkspacePath } from './utils/getWorkspaceInfo';
import { autoApplyToolIdMap } from './utils/editFile/claudeEdit';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getErrorMessage = (e: any) => (e instanceof Error ? e.message : String(e));

function getLanguageId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.lua': 'lua',
    '.json': 'json',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.md': 'markdown',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.sh': 'shellscript',
    '.bat': 'bat',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.vue': 'vue',
    '.svelte': 'svelte',
  };
  return langMap[ext] || 'plaintext';
}

export interface ApplyItem {
  toolCallId: string;
  filePath: string;
  finalResult: string;
  isCreateFile?: boolean;
  beforeEdit: string;
  type: 'edit' | 'write';
}

export interface ApplyFile {
  filePath: string;
  finalResult: string;
  isCreateFile?: boolean;
  originalContent: string;
}

interface DiffFile {
  filePath: string;
  originalContent: string;
  finalResult: string;
  editor: vscode.TextEditor;
  isNewFile?: boolean;
  tempFilePath?: string;
}

export class EditApplyProvider {
  private diffFiles: Map<string, DiffFile> = new Map();
  private disposables: vscode.Disposable[] = [];
  private previewEditor: vscode.TextEditor | null = null;

  constructor() {
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        if (!this.diffFiles.size) return;
        for (const [filePath, diffFile] of this.diffFiles) {
          if (!editors.includes(diffFile.editor)) {
            this.cleanupTempFile(diffFile);
            this.diffFiles.delete(filePath);
          }
        }
      })
    );
  }

  private static get isSlientApply() {
    const config = vscode.workspace.getConfiguration('CodeMaker');
    return config.get<boolean>('BackendApplyCode', false);
  }

  private cleanupTempFile(diffFile: DiffFile): void {
    if (diffFile.tempFilePath) {
      try {
        fs.unlinkSync(diffFile.tempFilePath);
        console.log(`[EditApplyProvider] 清理临时文件: ${diffFile.tempFilePath}`);
      } catch (err) {
        console.log(`[EditApplyProvider] 清理临时文件失败: ${diffFile.tempFilePath}, ${getErrorMessage(err)}`);
      }
    }
  }

  private generateTempFileName(filePath: string): string {
    const fileName = path.basename(filePath);
    const parsedPath = path.parse(fileName);
    const pathHash = this.hashString(filePath);
    return `${parsedPath.name}-before-${pathHash}${parsedPath.ext}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 更新文件内容（Y3 简化版：直接用 workspace.applyEdit）
   */
  private async updateFileContent(
    currentDocument: vscode.TextDocument,
    content: string,
    _isSlientApply = false,
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      currentDocument.positionAt(0),
      currentDocument.positionAt(currentDocument.getText().length),
    );
    edit.replace(currentDocument.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
    await currentDocument.save();
  }

  async previewDiffEdit(options: {
    filePath: string;
    beforeEdit: string;
    finalResult: string;
    isCreateFile?: boolean;
  }): Promise<{ success: boolean; message?: string }> {
    const { filePath, beforeEdit, finalResult, isCreateFile } = options;
    try {
      await this.closeAllDiffEditor();
      const fileName = path.basename(filePath);
      let targetDocument: vscode.TextDocument;
      let targetLanguage: string;
      const codeAfter = finalResult;

      if (isCreateFile) {
        targetLanguage = getLanguageId(fileName);
        targetDocument = await vscode.workspace.openTextDocument({
          language: targetLanguage,
          content: '',
        });
      } else {
        targetDocument = await vscode.workspace.openTextDocument(
          vscode.Uri.file(resolveWorkspacePath(filePath)),
        );
        targetLanguage = targetDocument.languageId;
        const currentContent = targetDocument.getText();
        if (targetDocument.isDirty) {
          return {
            success: false,
            message: '文件有未保存改动，请先保存并进行 reapply',
          };
        } else if (
          currentContent.replace(/\r\n/g, '\n') !== beforeEdit.replace(/\r\n/g, '\n')
        ) {
          return {
            success: false,
            message: '文件内容有变动，请尝试 reapply',
          };
        }
      }

      const afterDoc = await vscode.workspace.openTextDocument({
        language: targetLanguage,
        content: codeAfter,
      });

      await vscode.commands.executeCommand(
        'vscode.diff',
        targetDocument.uri,
        afterDoc.uri,
        `Diff - ${filePath}`,
        { preview: true, viewColumn: vscode.ViewColumn.Active },
      );

      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this.previewEditor = editor;
      }

      const diffFile: DiffFile = {
        filePath,
        originalContent: beforeEdit,
        finalResult,
        editor: editor as vscode.TextEditor,
      };
      this.diffFiles.set(filePath, diffFile);
      return { success: true };
    } catch (err) {
      return { success: false, message: getErrorMessage(err) };
    }
  }

  async previewDiffFile(options: {
    filePath: string;
    beforeEdit: string;
    finalResult: string;
    isCreateFile?: boolean;
  }): Promise<{ success: boolean; message?: string }> {
    const { filePath, beforeEdit, finalResult } = options;
    try {
      await this.closeAllDiffEditor();
      const codeBefore: string = beforeEdit;

      const tempDir = os.tmpdir();
      const tempFileName = this.generateTempFileName(filePath);
      const tempFilePath = path.join(tempDir, tempFileName);

      fs.writeFileSync(tempFilePath, codeBefore, 'utf-8');
      const tempUri = vscode.Uri.file(tempFilePath);

      const currentFileUri = vscode.Uri.file(resolveWorkspacePath(filePath));

      await vscode.commands.executeCommand(
        'vscode.diff',
        tempUri,
        currentFileUri,
        `Diff - ${filePath}`,
        { preview: true, viewColumn: vscode.ViewColumn.Active },
      );

      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this.previewEditor = editor;
      }

      const diffFile: DiffFile = {
        filePath,
        originalContent: codeBefore,
        finalResult,
        editor: editor as vscode.TextEditor,
        tempFilePath,
      };
      this.diffFiles.set(filePath, diffFile);
      return { success: true };
    } catch (err) {
      return { success: false, message: getErrorMessage(err) };
    }
  }

  checkDiffExist(filePath: string) {
    return this.diffFiles.has(filePath);
  }

  private async closeDiffEditor(diffFile: DiffFile): Promise<void> {
    const tabGroups = vscode.window.tabGroups.all;
    for (const tabGroup of tabGroups) {
      const tabs = tabGroup.tabs;
      for (const tab of tabs) {
        if (tab.label === `Diff - ${diffFile.filePath}`) {
          const editor = diffFile.editor;
          const edit = new vscode.WorkspaceEdit();
          if (editor.document.uri.scheme === 'untitled') {
            edit.replace(
              editor.document.uri,
              new vscode.Range(0, 0, editor.document.lineCount, 0),
              '',
            );
            await vscode.workspace.applyEdit(edit);
          }
          await vscode.window.tabGroups.close(tab);
          break;
        }
      }
    }
    this.cleanupTempFile(diffFile);
  }

  async closeAllDiffEditor(): Promise<void> {
    const tabGroups = vscode.window.tabGroups.all;
    for (const tabGroup of tabGroups) {
      const tabs = tabGroup.tabs;
      for (const tab of tabs) {
        if (tab.label.includes('cm-diff-preview')) {
          if (this.previewEditor) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              this.previewEditor.document.uri,
              new vscode.Range(0, 0, this.previewEditor.document.lineCount, 0),
              '',
            );
            this.previewEditor = null;
            await vscode.workspace.applyEdit(edit);
          }
          await vscode.window.tabGroups.close(tab);
        }
      }
    }
  }

  /**
   * 接受 Claude edit/write 结果并直接写盘
   * @param applyItem 应用信息
   * @param autoApply 是否自动应用（检测写入结果）
   * @param toolCallId 工具调用 ID（用于去重）
   */
  async acceptSingleEditWithClaude(
    applyItem: ApplyItem,
    autoApply?: boolean,
    toolCallId?: string,
  ): Promise<{ success: boolean; message?: string; isCreateFile?: boolean }> {
    // 已经自动应用过的不需要再应用
    if (toolCallId && autoApplyToolIdMap.get(toolCallId)) {
      return {
        success: true,
        isCreateFile: applyItem.isCreateFile,
      };
    }
    const { filePath, finalResult, isCreateFile } = applyItem;
    try {
      const absolutePath = filePath;
      if (!path.isAbsolute(absolutePath)) {
        return {
          success: false,
          message: `${absolutePath} is not a absolute path`,
        };
      }

      // 处理文件创建场景
      if (isCreateFile) {
        try {
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(absolutePath, '', 'utf-8');
        } catch (e) {
          // 忽略创建失败
        }
      }

      const currentDocument = await vscode.workspace.openTextDocument(
        vscode.Uri.file(absolutePath),
      );
      if (currentDocument.isDirty) {
        await currentDocument.save();
        await delay(100);
      }

      // 先把原有 diff 文件关闭
      const diffFile = this.diffFiles.get(filePath);
      if (diffFile) {
        await this.closeDiffEditor(diffFile);
        await delay(100);
      }

      await this.updateFileContent(currentDocument, finalResult);
      await delay(100);
      console.log(
        `[EditApplyProvider] acceptSingleEditWithClaude: 成功应用修改, filePath: ${filePath}`,
      );

      // 自动应用需要检测文件内容是否变化
      if (currentDocument.getText() !== finalResult && autoApply) {
        throw new Error('File content update was unsuccessful!');
      }

      return { success: true, isCreateFile };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.log(
        `[EditApplyProvider] acceptSingleEditWithClaude: 应用失败, filePath: ${filePath}, error: ${errorMessage}`,
      );
      return {
        success: false,
        message: `应用修改失败: ${errorMessage}`,
      };
    }
  }

  async acceptSingleEdit(
    applyItem: ApplyItem,
    force?: boolean,
  ): Promise<{ success: boolean; message?: string; isCreateFile?: boolean }> {
    const { filePath, finalResult, isCreateFile, beforeEdit, toolCallId, type } = applyItem;
    try {
      if (typeof finalResult !== 'string') {
        throw new Error('Final result must be a string');
      }
      if (['edit', 'write'].includes(type)) {
        return await this.acceptSingleEditWithClaude(applyItem, false, toolCallId);
      }

      const diffFile = this.diffFiles.get(filePath);
      let absolutePath: string;
      let afterEdit: string;
      let currentDocument: vscode.TextDocument;

      if (diffFile) {
        absolutePath = resolveWorkspacePath(diffFile.filePath);
      } else {
        absolutePath = resolveWorkspacePath(filePath);
      }

      // 先确认文件是否存在
      let fileExist = false;
      try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
        fileExist = stat.type === vscode.FileType.File;
      } catch {
        fileExist = false;
      }

      if (diffFile) {
        afterEdit = diffFile.editor.document.getText();
      } else {
        afterEdit = finalResult;
      }

      if (isCreateFile && !fileExist) {
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, '', 'utf-8');
        currentDocument = await vscode.workspace.openTextDocument(
          vscode.Uri.file(absolutePath),
        );
      } else {
        currentDocument = await vscode.workspace.openTextDocument(
          vscode.Uri.file(absolutePath),
        );
        if (currentDocument.isDirty) {
          console.log(
            `[EditApplyProvider] apply: 文件有未保存改动, toolCallId: ${toolCallId}, filePath: ${filePath}`,
          );
          return {
            success: false,
            message: '文件有未保存改动，请先保存并进行 reapply',
          };
        }
      }

      if (currentDocument) {
        const currentContent = currentDocument.getText();
        if (
          currentContent.replace(/\r\n/g, '\n') === afterEdit.replace(/\r\n/g, '\n') &&
          fileExist
        ) {
          if (diffFile) {
            const isDiffEditorActive =
              vscode.window.activeTextEditor === diffFile.editor;
            if (
              isDiffEditorActive &&
              currentContent.replace(/\r\n/g, '\n') !== finalResult.replace(/\r\n/g, '\n')
            ) {
              await this.closeDiffEditor(diffFile);
              this.diffFiles.delete(filePath);
              await this.updateFileContent(currentDocument, finalResult);
              await delay(100);
              await this.previewDiffFile({
                filePath,
                beforeEdit,
                finalResult,
                isCreateFile: false,
              });
            }
          }
          return { success: true };
        }

        if (
          currentContent.replace(/\s/g, '') !== beforeEdit.replace(/\s/g, '') &&
          fileExist
        ) {
          if (!force) {
            console.log(
              `[EditApplyProvider] apply: 文件内容有变动, toolCallId: ${toolCallId}, filePath: ${filePath}`,
            );
            return {
              success: false,
              message: '文件内容有变动，请尝试 reapply',
            };
          }
        }

        await delay(100);
        await this.updateFileContent(currentDocument, afterEdit);
        if (diffFile) {
          await this.closeDiffEditor(diffFile);
          this.diffFiles.delete(filePath);
        }
        return { success: true };
      } else {
        console.log(
          `[EditApplyProvider] apply: 文件读取异常, toolCallId: ${toolCallId}, filePath: ${filePath}`,
        );
        return { success: false, message: 'apply 文件读取异常' };
      }
    } catch (err) {
      console.log(
        `[EditApplyProvider] apply: 文件修改失败, toolCallId: ${toolCallId}, filePath: ${filePath} ${getErrorMessage(err)}`,
      );
      return { success: false, message: 'apply 文件修改失败' };
    }
  }

  async revertSingleEdit(applyFile: ApplyFile) {
    const { filePath, originalContent, isCreateFile } = applyFile;
    try {
      const diffFile = this.diffFiles.get(filePath);
      const absolutePath = resolveWorkspacePath(filePath);

      let fileExist = false;
      try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
        fileExist = stat.type === vscode.FileType.File;
      } catch {
        fileExist = false;
      }

      const afterEdit = originalContent;

      if (isCreateFile) {
        if (!fileExist) {
          return { success: true };
        } else {
          fs.unlinkSync(absolutePath);
        }
      } else {
        if (!fileExist) {
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(absolutePath, '', 'utf-8');
        }
        const currentDocument = await vscode.workspace.openTextDocument(
          vscode.Uri.file(absolutePath),
        );
        if (currentDocument) {
          const currentContent = currentDocument.getText();
          if (
            currentContent.replace(/\r\n/g, '\n') === afterEdit.replace(/\r\n/g, '\n')
          ) {
            return { success: true };
          }
        }
        await this.updateFileContent(currentDocument, afterEdit);
      }

      if (diffFile) {
        await this.closeDiffEditor(diffFile);
        this.diffFiles.delete(filePath);
      }

      return { success: true };
    } catch (err) {
      console.log(`[EditApplyProvider] 回退文件改动失败，${getErrorMessage(err)}`);
      return { success: false, message: '回退文件改动失败' };
    }
  }

  dispose(): void {
    for (const [, diffFile] of this.diffFiles) {
      this.cleanupTempFile(diffFile);
    }
    this.disposables.forEach((d) => d.dispose());
    this.diffFiles.clear();
  }
}

let editApplyProvider: EditApplyProvider | null = null;

export function initEditApplyProvider(_context: vscode.ExtensionContext) {
  if (!editApplyProvider) {
    editApplyProvider = new EditApplyProvider();
  }
}

export function getEditApplyProvider() {
  if (!editApplyProvider) {
    editApplyProvider = new EditApplyProvider();
  }
  return editApplyProvider;
}
