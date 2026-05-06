import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import {
  Agent,
  AgentLoadResult,
  AgentsHandlerOptions,
  AgentMetaData,
  AgentIndexItem,
  GetAgentResult,
  AgentSource,
  AgentSourceConfig,
} from './types';
const printLog = (...args: any[]) => console.log('[AgentsHandler]', ...args);
const getErrorMessage = (e: any) => (e instanceof Error ? e.message : String(e));
import AgentMdcParser from './parser';

const EXCLUDED_DIRECTORIES = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', '.next', '.nuxt',
]);

// Agent 来源配置 - 按优先级顺序（后加载覆盖先加载）
const AGENT_SOURCES: AgentSourceConfig[] = [
  {
    source: 'claude-user',
    directory: '.claude/agents',
    isUserLevel: true
  },
  {
    source: 'codemaker-user',
    directory: '.codemaker/agents',
    isUserLevel: true
  },
  {
    source: 'claude-project',
    directory: '.claude/agents',
    isUserLevel: false
  },
  {
    source: 'codemaker-project',
    directory: '.codemaker/agents',
    isUserLevel: false
  }
];

export function getSourceLabel(source: AgentSource): string {
  const config = AGENT_SOURCES.find(s => s.source === source);
  if (config) {
    return config.isUserLevel ? `~/${config.directory}` : config.directory;
  }
  return source;
}

export class AgentsHandler {
  private static instance: AgentsHandler | null = null;
  private agents: Map<string, Agent> = new Map();
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;
  private readonly enableWatcher: boolean;

  // 轮询配置（兜底机制，覆盖 watcher 监听不存在路径的边缘情况）
  private static readonly POLL_INTERVAL_MS = 5000;
  private static readonly DEBOUNCE_MS = 200;
  // 递归扫描最大深度（防止目录结构太深导致性能问题）
  private static readonly MAX_SCAN_DEPTH = 5;

  private constructor(options: AgentsHandlerOptions = {}) {
    this.enableWatcher = options.enableWatcher !== false;
    printLog(`[AgentsHandler] Instance created`);
  }

  public static getInstance(options?: AgentsHandlerOptions): AgentsHandler {
    if (!AgentsHandler.instance) {
      AgentsHandler.instance = new AgentsHandler(options);
    }
    return AgentsHandler.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      printLog('[AgentsHandler] Already initialized');
      return;
    }

    try {
      printLog('[AgentsHandler] Starting initialization...');

      await this.loadAgents();

      // 同步到 webview（Y3: 初始化时不主动推送，等 webview 请求时再同步）
      // this.syncAgents();

      if (this.enableWatcher) {
        await this.initializeFileWatcher();
      }

      this.isInitialized = true;
      printLog(`[AgentsHandler] Initialization completed - agentsCount: ${this.agents.size}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      printLog(`[AgentsHandler] Initialization failed - error: ${errorMessage}`);
      throw new Error(`Failed to initialize AgentsHandler: ${errorMessage}`);
    }
  }

  private getUserHomeUri(): vscode.Uri {
    return vscode.Uri.file(os.homedir());
  }

  public async loadAgents(): Promise<AgentLoadResult> {
    printLog('[AgentsHandler] Loading agents from multiple sources...');

    const result: AgentLoadResult = { agents: [], errors: [] };
    this.agents.clear();

    for (const sourceConfig of AGENT_SOURCES) {
      try {
        const basePaths = this.getSourceBasePaths(sourceConfig);
        printLog(`[AgentsHandler] Loading agents from ${sourceConfig.source} - basePaths: ${basePaths.join(', ')}`);
        if (basePaths.length === 0 && !sourceConfig.isUserLevel) {
          printLog(`[AgentsHandler] No workspace for ${sourceConfig.source}, skipping`);
          continue;
        }

        for (const basePath of basePaths) {
          const agentsPath = vscode.Uri.joinPath(basePath, sourceConfig.directory);

          printLog(`[AgentsHandler] Checking agents directory for ${sourceConfig.source} at ${agentsPath.fsPath}`);

          if (!await this.isDirectory(agentsPath)) {
            printLog(`[AgentsHandler] Agents directory not found - source: ${sourceConfig.source}, path: ${agentsPath.fsPath}`);
            continue;
          }

          const loadedCount = await this.loadAgentsFromDirectory(agentsPath, sourceConfig.source, result);
          printLog(`[AgentsHandler] Loaded ${loadedCount} agents from ${sourceConfig.source}`);
        }
      } catch (error) {
        printLog(`[AgentsHandler] Failed to load agents from ${sourceConfig.source} - error: ${getErrorMessage(error)}`);
      }
    }

    result.agents = Array.from(this.agents.values());
    printLog(`[AgentsHandler] Agents loaded - total: ${this.agents.size}`);

    return result;
  }

  private async loadAgentsFromDirectory(
    agentsPath: vscode.Uri,
    source: AgentSource,
    result: AgentLoadResult,
    depth: number = 0
  ): Promise<number> {
    // 超过最大深度，停止递归
    if (depth > AgentsHandler.MAX_SCAN_DEPTH) {
      printLog(`[AgentsHandler] Max scan depth reached, skipping: ${agentsPath.fsPath}`);
      return 0;
    }

    let loadedCount = 0;
    const entries = await vscode.workspace.fs.readDirectory(agentsPath);

    for (const [name, type] of entries) {
      const isDirectoryEntry =
        (type & vscode.FileType.Directory) === vscode.FileType.Directory;
      if (isDirectoryEntry && EXCLUDED_DIRECTORIES.has(name)) {
        continue;
      }

      try {
        if (type === vscode.FileType.File && name.endsWith('.md')) {
          const agent = await this.loadFileAgent(
            vscode.Uri.joinPath(agentsPath, name),
            source
          );
          if (agent) {
            this.agents.set(agent.name, agent);
            loadedCount++;
          }
        } else if (isDirectoryEntry) {
          // 递归搜索子目录
          loadedCount += await this.loadAgentsFromDirectory(
            vscode.Uri.joinPath(agentsPath, name),
            source,
            result,
            depth + 1
          );
        }
      } catch (error) {
        result.errors.push({
          path: path.join(agentsPath.fsPath, name),
          error: getErrorMessage(error)
        });
      }
    }

    return loadedCount;
  }

  private async loadFileAgent(filePath: vscode.Uri, source: AgentSource): Promise<Agent | null> {
    try {
      const content = await vscode.workspace.fs.readFile(filePath);
      const contentString = Buffer.from(content).toString('utf8');
      const stat = await vscode.workspace.fs.stat(filePath);

      // 使用 AgentMdcParser 解析
      const fileName = path.basename(filePath.fsPath);
      const parseResult = AgentMdcParser.parse(contentString, fileName);

      if (!parseResult.success) {
        throw new Error(`Failed to parse agent file: ${parseResult.error}`);
      }

      const metaData = parseResult.metaData;

      // 验证必需字段
      if (!metaData.name || !metaData.description) {
        throw new Error('Missing required fields: name and description');
      }

      return {
        metaData,
        name: metaData.name,
        content: contentString,
        path: filePath.fsPath,
        lastModified: stat.mtime,
        source
      };
    } catch (error) {
      throw error;
    }
  }

  public getAgentIndex(): AgentIndexItem[] {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.metaData.description,
      source: agent.source,
      model: agent.metaData.model,
      // tools: agent.metaData.tools,
      prompt: agent.metaData.prompt
    }));
  }

  public getAgentByName(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  public getAgent(name: string): GetAgentResult {
    const agent = this.getAgentByName(name);

    if (!agent) {
      return {
        success: false,
        error: `Agent "${name}" not found. Available agents: ${
          Array.from(this.agents.keys()).join(', ')
        }`
      };
    }

    return {
      success: true,
      agent: {
        name: agent.name,
        content: agent.content,
        path: agent.path,
        source: agent.source,
        metaData: agent.metaData
      }
    };
  }

  /**
   * 获取 AgentSourceConfig 对应的基础路径列表
   */
  private getSourceBasePaths(sourceConfig: AgentSourceConfig): vscode.Uri[] {
    if (sourceConfig.isUserLevel) {
      return [this.getUserHomeUri()];
    }
    return vscode.workspace.workspaceFolders?.map(folder => folder.uri) ?? [];
  }

  private createDebouncedReload(): { scheduleReload: () => void; dispose: () => void } {
    let timer: NodeJS.Timeout | null = null;

    const reload = async () => {
      await this.loadAgents();
      this.syncAgents();
      printLog('[AgentsHandler] Agents reloaded due to file change');
    };

    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          void reload();
        } catch (error) {
          console.error('Reload failed:', error);
        }
      }, AgentsHandler.DEBOUNCE_MS);
    };

    const dispose = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    return { scheduleReload, dispose };
  }

  private startDirectoryPolling(onDirectoryChange: () => void): vscode.Disposable {
    const dirContentCache = new Map<string, string>();
    let polling = false;

    const getDirectoryContentHash = async (dirUri: vscode.Uri): Promise<string | null> => {
      try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        // 只关注目录和 .md 文件
        const relevantNames = entries
          .filter(([, type]) =>
            (type & vscode.FileType.Directory) === vscode.FileType.Directory ||
            (type === vscode.FileType.File)
          )
          .map(([name]) => name)
          .sort()
          .join(',');
        return relevantNames;
      } catch {
        return null; // 目录不存在
      }
    };

    const poll = async () => {
      if (polling) return;
      polling = true;
      for (const sourceConfig of AGENT_SOURCES) {
        const basePaths = this.getSourceBasePaths(sourceConfig);
        for (const basePath of basePaths) {
          const agentsPath = vscode.Uri.joinPath(basePath, sourceConfig.directory);
          const contentHash = await getDirectoryContentHash(agentsPath);
          const cached = dirContentCache.get(agentsPath.fsPath);

          if (cached === undefined) {
            dirContentCache.set(agentsPath.fsPath, contentHash ?? '');
          } else if (cached !== (contentHash ?? '')) {
            dirContentCache.set(agentsPath.fsPath, contentHash ?? '');
            printLog(`[AgentsHandler] Directory content changed: ${agentsPath.fsPath}`);
            onDirectoryChange();
          }
        }
      }
      polling = false;
    };

    const timer = setInterval(() => void poll(), AgentsHandler.POLL_INTERVAL_MS);
    return new vscode.Disposable(() => clearInterval(timer));
  }

  /**
   * 检查路径是否为目录
   */
  private async isDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return (stat.type & vscode.FileType.Directory) === vscode.FileType.Directory;
    } catch {
      return false;
    }
  }

  /**
   * 为单个来源创建文件监听器
   */
  private setupWatchersForSource(
    sourceConfig: AgentSourceConfig,
    basePath: vscode.Uri,
    onChange: () => void
  ): vscode.Disposable[] {
    const watchers: vscode.Disposable[] = [];

    // 监听 agents 目录本身（处理目录创建/删除）
    const dirWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(basePath, sourceConfig.directory)
    );
    dirWatcher.onDidCreate(onChange);
    dirWatcher.onDidChange(onChange);
    dirWatcher.onDidDelete(onChange);
    watchers.push(dirWatcher);

    // 监听 agents 目录下的子目录（处理 agent 目录的创建/删除）
    const subDirWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(basePath, `${sourceConfig.directory}/*`)
    );
    subDirWatcher.onDidCreate(onChange);
    subDirWatcher.onDidChange(onChange);
    subDirWatcher.onDidDelete(onChange);
    watchers.push(subDirWatcher);

    // 监听 agents 目录下的 .md 文件
    const mdWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(basePath, `${sourceConfig.directory}/**/*.md`)
    );
    mdWatcher.onDidCreate(onChange);
    mdWatcher.onDidChange(onChange);
    mdWatcher.onDidDelete(onChange);
    watchers.push(mdWatcher);

    return watchers;
  }

  /**
   * 初始化文件监听器 - 监听所有来源目录
   */
  private async initializeFileWatcher(): Promise<void> {
    const { scheduleReload, dispose: disposeDebounce } = this.createDebouncedReload();
    this.disposables.push(new vscode.Disposable(disposeDebounce));

    this.disposables.push(this.startDirectoryPolling(scheduleReload));

    // 为每个来源创建 watcher
    for (const sourceConfig of AGENT_SOURCES) {
      const basePaths = this.getSourceBasePaths(sourceConfig);
      if (basePaths.length === 0 && !sourceConfig.isUserLevel) {
        printLog(`[AgentsHandler] No workspace for ${sourceConfig.source}, skipping watchers`);
        continue;
      }

      for (const basePath of basePaths) {
        try {
          const watchers = this.setupWatchersForSource(sourceConfig, basePath, scheduleReload);
          this.disposables.push(...watchers);
          printLog(`[AgentsHandler] File watcher initialized for ${sourceConfig.source} at ${basePath.fsPath}`);
        } catch (error) {
          printLog(`[AgentsHandler] Failed to initialize watcher for ${sourceConfig.source}: ${getErrorMessage(error)}`);
        }
      }
    }
  }

  /**
   * 同步 agents 到 webview
   * Y3: 通过 webviewProvider 实例的 _sendToWebview 发送
   */
  public syncAgents(webviewProvider?: any, panelId?: string): void {
    if (webviewProvider && webviewProvider._sendToWebview) {
      const agents = this.getAgentIndex();
      webviewProvider._sendToWebview({
        type: 'SYNC_AGENTS',
        data: agents,
      });
    }
  }

  public getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  public get count(): number {
    return this.agents.size;
  }

  public dispose(): void {
    printLog('[AgentsHandler] Disposing resources...');

    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }

    this.agents.clear();
    this.isInitialized = false;

    AgentsHandler.instance = null;

    printLog('[AgentsHandler] Resources disposed');
  }
}

export function getAgentsHandler(options?: AgentsHandlerOptions): AgentsHandler {
  return AgentsHandler.getInstance(options);
}


export default AgentsHandler;
