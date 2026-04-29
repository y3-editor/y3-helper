/**
 * ignoreHandler — .y3makerignore 配置管理模块
 *
 * 负责 `.y3maker/.y3makerignore` 文件的读取、解析、缓存和文件变更监听。
 * 其他模块（如沙箱命令、文件过滤等）可通过 getIgnoreHandler() 获取实例，
 * 调用 getIgnoreInstance() 判断路径是否应该忽略。
 *
 * 遵循项目 Handler 模式：init → get → dispose；
 * 并将 FileWatcher 注册到 context.subscriptions 中。
 *
 * 支持软链接（symlink）场景：当 `.y3makerignore` 文件是软链接时，
 * 会同时监听软链接本身和其真实目标文件的变更，确保目标文件被外部修改时
 * 也能及时感知并重新加载配置。
 *
 * 移植自上游 codestream-vscode-extension ignoreHandler，
 * 将 .codemakerignore 改为 .y3makerignore。
 */
import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';
import ignore, { Ignore } from 'ignore';

import { getWorkspaceRootPath } from '../utils/getWorkspaceInfo';
import { syncIgnoreState } from '../syncIgnoreState';

/** `.y3makerignore` 相对于工作区根目录的路径 */
const Y3MAKERIGNORE_REL = '.y3maker/.y3makerignore';

let ignoreHandlerInstance: IgnoreHandler | null = null;

export class IgnoreHandler {
  private context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  /** 缓存的 Ignore 实例，null 表示配置文件不存在或读取失败 */
  private cachedIgnore: Ignore | null = null;

  /** 原始规则行列表（去掉空行和注释），用于逐条匹配定位命中规则 */
  private rules: string[] = [];

  /** 标记缓存是否已初始化（区分"未加载"与"加载后为 null"） */
  private cacheLoaded = false;

  /** 工作区根路径 */
  private workspaceRoot: string | undefined;

  /** 软链接解析后的真实文件路径，非软链接时为 undefined */
  private symlinkRealPath: string | undefined;

  /** 远程配置解析出的规则列表（去掉空行和注释） */
  private remoteRules: string[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspaceRoot = getWorkspaceRootPath() || undefined;
    this.init();
  }

  // -----------------------------------------------------------------------
  // 初始化 & 文件监听
  // -----------------------------------------------------------------------

  private init(): void {
    if (!this.workspaceRoot) {
      console.log('[ignoreHandler] 无工作区根目录，跳过初始化');
      return;
    }

    // 首次加载配置
    this.reloadConfig();

    // 监听 .y3makerignore 文件的创建、修改、删除
    const workspaceRootUri = vscode.Uri.file(this.workspaceRoot);
    const pattern = new vscode.RelativePattern(
      workspaceRootUri,
      Y3MAKERIGNORE_REL
    );
    console.log(
      `[ignoreHandler] 注册 FileWatcher, base=${workspaceRootUri.fsPath}, pattern=${Y3MAKERIGNORE_REL}`
    );
    const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.disposables.push(
      fileWatcher.onDidChange((uri) => {
        console.log(`[ignoreHandler] >>> onDidChange 触发, uri=${uri.fsPath}`);
        this.handleFileChanged();
      })
    );

    this.disposables.push(
      fileWatcher.onDidCreate((uri) => {
        console.log(`[ignoreHandler] >>> onDidCreate 触发, uri=${uri.fsPath}`);
        this.handleFileChanged();
      })
    );

    this.disposables.push(
      fileWatcher.onDidDelete((uri) => {
        console.log(`[ignoreHandler] >>> onDidDelete 触发, uri=${uri.fsPath}`);
        this.rules = [];
        this.cacheLoaded = true;
        this.rebuildIgnoreInstance();
        console.log('[ignoreHandler] 本地配置删除，已用远程规则重建');
        // 文件删除后同步状态给 webview
        syncIgnoreState();
      })
    );

    this.disposables.push(fileWatcher);
    this.context.subscriptions.push(fileWatcher);

    // 兜底：监听编辑器内的文件保存事件
    // 在 WSL(/mnt/) 和网络文件系统等场景下，inotify 无法感知文件变更，
    // FileSystemWatcher 的 onDidChange 不会触发，因此需要通过
    // onDidSaveTextDocument 作为补充来捕获编辑器内的保存操作。
    const ignoreFilePath = path.join(
      this.workspaceRoot,
      Y3MAKERIGNORE_REL
    );
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (
          doc.uri.fsPath === ignoreFilePath ||
          (this.symlinkRealPath && doc.uri.fsPath === this.symlinkRealPath)
        ) {
          console.log(
            `[ignoreHandler] >>> onDidSaveTextDocument 触发, uri=${doc.uri.fsPath}`
          );
          this.handleFileChanged();
        }
      })
    );

    // 软链接支持：检测 .y3makerignore 是否为软链接，
    // 若是则额外监听真实目标文件的变更
    this.watchSymlinkTarget(ignoreFilePath);

    console.log(
      `[ignoreHandler] 初始化完成，工作区: ${this.workspaceRoot}, 初始规则数: ${this.rules.length}, 规则: ${JSON.stringify(this.rules)}`
    );
  }

  // -----------------------------------------------------------------------
  // 软链接监听
  // -----------------------------------------------------------------------

  private async watchSymlinkTarget(symlinkPath: string): Promise<void> {
    try {
      const lstat = await fs.promises.lstat(symlinkPath);
      if (!lstat.isSymbolicLink()) {
        return;
      }

      const realPath = await fs.promises.realpath(symlinkPath);
      this.symlinkRealPath = realPath;
      console.log(`[ignoreHandler] 检测到软链接: ${symlinkPath} -> ${realPath}`);

      const realPattern = new vscode.RelativePattern(
        vscode.Uri.file(path.dirname(realPath)),
        path.basename(realPath)
      );
      const realWatcher = vscode.workspace.createFileSystemWatcher(realPattern);

      this.disposables.push(
        realWatcher.onDidChange((uri) => {
          console.log(`[ignoreHandler] >>> onDidChange (symlink target) 触发, uri=${uri.fsPath}`);
          this.handleFileChanged();
        })
      );

      this.disposables.push(
        realWatcher.onDidCreate((uri) => {
          console.log(`[ignoreHandler] >>> onDidCreate (symlink target) 触发, uri=${uri.fsPath}`);
          this.handleFileChanged();
        })
      );

      this.disposables.push(
        realWatcher.onDidDelete((uri) => {
          console.log(`[ignoreHandler] >>> onDidDelete (symlink target) 触发, uri=${uri.fsPath}`);
          this.rules = [];
          this.cacheLoaded = true;
          this.rebuildIgnoreInstance();
          console.log('[ignoreHandler] 软链接目标删除，已用远程规则重建');
        })
      );

      this.disposables.push(realWatcher);
      this.context.subscriptions.push(realWatcher);
    } catch (err) {
      // 文件不存在等场景下 lstat/realpath 会抛异常，
      // 此时无需额外监听，ignore 文件创建后会由原本 watcher 触发
      console.log(`[ignoreHandler] 软链接检测跳过: ${err}`);
    }
  }

  // -----------------------------------------------------------------------
  // 文件变更处理
  // -----------------------------------------------------------------------

  private handleFileChanged(): void {
    const prevRules = [...this.rules];
    this.reloadConfig();
    console.log(
      `[ignoreHandler] reload 完成: 旧规则数=${prevRules.length}, 新规则数=${this.rules.length}, 新规则: ${JSON.stringify(this.rules)}`
    );
    // 文件变更后同步状态给 webview
    syncIgnoreState();
  }

  // -----------------------------------------------------------------------
  // 配置加载
  // -----------------------------------------------------------------------

  private reloadConfig(): void {
    if (!this.workspaceRoot) {
      this.cachedIgnore = null;
      this.rules = [];
      this.cacheLoaded = true;
      this.rebuildIgnoreInstance();
      return;
    }

    const filePath = path.join(this.workspaceRoot, Y3MAKERIGNORE_REL);

    if (!fs.existsSync(filePath)) {
      console.log(`[ignoreHandler] 配置文件不存在: ${filePath}`);
      this.rules = [];
      this.cacheLoaded = true;
      this.rebuildIgnoreInstance();
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      // 解析有效规则行（去掉空行和注释）
      this.rules = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
      this.cacheLoaded = true;
      this.rebuildIgnoreInstance();
      console.log(`[ignoreHandler] 配置加载成功: ${filePath}`);
    } catch (err) {
      console.log(`[ignoreHandler] 读取配置失败: ${err}`);
      this.rules = [];
      this.cacheLoaded = true;
      this.rebuildIgnoreInstance();
    }
  }

  // -----------------------------------------------------------------------
  // 规则合并
  // -----------------------------------------------------------------------

  private rebuildIgnoreInstance(): void {
    const allRules = [...new Set([...this.rules, ...this.remoteRules])];
    if (allRules.length === 0) {
      this.cachedIgnore = null;
      return;
    }
    const ig = ignore();
    for (const rule of allRules) {
      ig.add(rule);
    }
    this.cachedIgnore = ig;
  }

  // -----------------------------------------------------------------------
  // 对外 API
  // -----------------------------------------------------------------------

  /**
   * 获取当前缓存的 Ignore 实例。
   * 返回 null 表示配置文件不存在或读取失败。
   */
  getIgnoreInstance(): Ignore | null {
    if (!this.cacheLoaded) {
      this.reloadConfig();
    }
    return this.cachedIgnore;
  }

  /**
   * 判断 `.y3makerignore` 配置文件是否存在（已加载到缓存）。
   */
  hasIgnoreConfig(): boolean {
    if (!this.cacheLoaded) {
      this.reloadConfig();
    }
    return this.cachedIgnore !== null;
  }

  /**
   * 判断指定的相对路径是否应被忽略。
   * 如果没有配置文件，返回 false（不忽略任何路径）。
   *
   * @param relativePath 相对于工作区根目录的路径（目录需以 / 结尾）
   */
  isIgnored(relativePath: string): boolean {
    const ig = this.getIgnoreInstance();
    if (!ig) {
      return false;
    }
    // ignore 库要求路径不能以 ../ 或 ..\ 开头，工作区外的路径直接返回 false
    if (relativePath.startsWith('..')) {
      return false;
    }
    return ig.ignores(relativePath);
  }

  /**
   * 获取指定相对路径命中的第一条忽略规则。
   * 逐条规则创建临时 Ignore 实例进行测试，返回第一条匹配的规则字符串。
   * 如果没有命中任何规则，返回 undefined。
   *
   * @param relativePath 相对于工作区根目录的路径
   */
  getMatchedRule(relativePath: string): string | undefined {
    if (relativePath.startsWith('..')) {
      return undefined;
    }
    const allRules = [...new Set([...this.rules, ...this.remoteRules])];
    if (!allRules.length) {
      return undefined;
    }
    for (const rule of allRules) {
      const ig = ignore().add(rule);
      if (ig.ignores(relativePath)) {
        return rule;
      }
    }
    return undefined;
  }

  /**
   * 获取当前有效的忽略规则列表（本地 + 远程合并后去重）。
   */
  getRules(): string[] {
    return [...new Set([...this.rules, ...this.remoteRules])];
  }

  /**
   * 获取工作区根路径。
   */
  getWorkspaceRoot(): string | undefined {
    return this.workspaceRoot;
  }

  // -----------------------------------------------------------------------
  // 生命周期管理
  // -----------------------------------------------------------------------

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.cachedIgnore = null;
    this.rules = [];
    this.remoteRules = [];
    this.cacheLoaded = false;
    this.symlinkRealPath = undefined;
    console.log('[ignoreHandler] 已销毁');
  }
}

// ---------------------------------------------------------------------------
// 模块级单例管理函数
// ---------------------------------------------------------------------------

/**
 * 初始化 IgnoreHandler（推荐在 extension.ts activate 中调用）。
 */
export function initIgnoreHandler(
  context: vscode.ExtensionContext
): IgnoreHandler {
  if (!ignoreHandlerInstance) {
    ignoreHandlerInstance = new IgnoreHandler(context);
  }
  return ignoreHandlerInstance;
}

/**
 * 获取 IgnoreHandler 实例。
 */
export function getIgnoreHandler(): IgnoreHandler | null {
  return ignoreHandlerInstance;
}

/**
 * 销毁 IgnoreHandler 并释放资源。
 */
export function disposeIgnoreHandler(): void {
  if (ignoreHandlerInstance) {
    ignoreHandlerInstance.dispose();
    ignoreHandlerInstance = null;
  }
}
