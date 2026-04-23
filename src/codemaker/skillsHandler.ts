import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─────────────────────────────────────────────
//  类型定义
// ─────────────────────────────────────────────

export type SkillSource =
  | 'y3maker-project' | 'y3maker-user'
  | 'codemaker-project' | 'codemaker-user'
  | 'claude-project' | 'claude-user'
  | 'agents-project' | 'agents-user';

export interface SkillSourceConfig {
  source: SkillSource;
  directory: string;
  isUserLevel: boolean;
}

export interface SkillMetaData {
  name: string;
  description: string;
  description_cn?: string;
  userInvocable?: boolean;
}

export interface Skill {
  metaData: SkillMetaData;
  name: string;
  content: string;
  path: string;
  source: SkillSource;
}

export interface SkillIndexItem {
  name: string;
  display_name?: string;
  description: string;
  description_cn?: string;
  source: SkillSource;
  path: string;
  userInvocable?: boolean;
}

export interface UseSkillResult {
  success: boolean;
  skill?: {
    name: string;
    content: string;
    path: string;
    source: SkillSource;
    resources?: { cwd: string; files: string[] };
  };
  error?: string;
}

export interface SkillConfig {
  name: string;
  disabled: boolean;
}

// ─────────────────────────────────────────────
//  来源配置（按优先级顺序，后加载覆盖先加载）
// ─────────────────────────────────────────────

const SKILL_SOURCES: SkillSourceConfig[] = [
  { source: 'y3maker-user', directory: '.y3maker/skills', isUserLevel: true },
  { source: 'y3maker-project', directory: '.y3maker/skills', isUserLevel: false },
  { source: 'codemaker-user', directory: '.codemaker/skills', isUserLevel: true },
  { source: 'codemaker-project', directory: '.codemaker/skills', isUserLevel: false },
  { source: 'claude-user', directory: '.claude/skills', isUserLevel: true },
  { source: 'claude-project', directory: '.claude/skills', isUserLevel: false },
  { source: 'agents-user', directory: '.agents/skills', isUserLevel: true },
  { source: 'agents-project', directory: '.agents/skills', isUserLevel: false },
];

// ─────────────────────────────────────────────
//  内联 MdcParser
// ─────────────────────────────────────────────

interface MdcParseResult {
  success: boolean;
  metaData?: Record<string, any>;
  content?: string;
  error?: string;
}

function parseMdc(raw: string): MdcParseResult {
  // 统一换行符：将 CRLF 转为 LF，避免 \r 残留导致 YAML 解析异常
  raw = raw.replace(/\r\n/g, '\n');
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { success: false, error: 'No front-matter found' };
  }

  const yamlBlock = match[1];
  const content = match[2];
  const metaData: Record<string, any> = {};

  for (const line of yamlBlock.split('\n')) {
    const kv = line.match(/^(\S+):\s*(.+)$/);
    if (kv) {
      const key = kv[1].trim();
      let value: any = kv[2].trim();
      // boolean coercion
      if (value === 'true') { value = true; }
      else if (value === 'false') { value = false; }
      metaData[key] = value;
    }
  }

  return { success: true, metaData, content };
}

// ─────────────────────────────────────────────
//  排除目录集合
// ─────────────────────────────────────────────

const EXCLUDED_DIRECTORIES = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.pytest_cache', '.mypy_cache',
  'vendor', 'target', 'bin', 'obj',
]);

// ─────────────────────────────────────────────
//  SkillsHandler 类
// ─────────────────────────────────────────────

export class SkillsHandler {
  private static instance: SkillsHandler | null = null;
  private skills: Map<string, Skill> = new Map();
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;
  private skillConfigs: Map<string, SkillConfig> = new Map();
  private context: vscode.ExtensionContext | null = null;

  private static readonly POLL_INTERVAL_MS = 5000;
  private static readonly DEBOUNCE_MS = 200;
  private static readonly MAX_SCAN_DEPTH = 5;

  private constructor() {
    console.log('[SkillsHandler] Instance created');
  }

  public static getInstance(): SkillsHandler {
    if (!SkillsHandler.instance) {
      SkillsHandler.instance = new SkillsHandler();
    }
    return SkillsHandler.instance;
  }

  // ── 初始化 ──

  public async initialize(context?: vscode.ExtensionContext): Promise<void> {
    if (this.isInitialized) {
      console.log('[SkillsHandler] Already initialized');
      return;
    }

    if (context) {
      this.context = context;
    }

    try {
      console.log('[SkillsHandler] Starting initialization...');

      // 恢复 skillConfigs
      this.restoreSkillConfigs();

      await this.loadSkills();
      this.syncSkills();
      await this.initializeFileWatcher();

      this.isInitialized = true;
      console.log('[SkillsHandler] Initialization completed - skillsCount:', this.skills.size);
    } catch (error: any) {
      console.log('[SkillsHandler] Initialization failed -', error?.message);
      throw new Error(`Failed to initialize SkillsHandler: ${error?.message}`);
    }
  }

  private restoreSkillConfigs(): void {
    if (!this.context) { return; }
    try {
      const saved = this.context.globalState.get<SkillConfig[]>('skillsHandler.skillConfigs', []);
      this.skillConfigs.clear();
      for (const cfg of saved) {
        this.skillConfigs.set(cfg.name, cfg);
      }
      console.log('[SkillsHandler] Restored skillConfigs count:', this.skillConfigs.size);
    } catch {
      // ignore
    }
  }

  private persistSkillConfigs(): void {
    if (!this.context) { return; }
    try {
      const arr = Array.from(this.skillConfigs.values());
      this.context.globalState.update('skillsHandler.skillConfigs', arr);
    } catch {
      // ignore
    }
  }

  // ── 多来源加载 ──

  public async loadSkills(): Promise<{ skills: Skill[]; errors: { path: string; error: string }[] }> {
    console.log('[SkillsHandler] Loading skills from multiple sources...');

    const result: { skills: Skill[]; errors: { path: string; error: string }[] } = { skills: [], errors: [] };
    this.skills.clear();

    for (const sourceConfig of SKILL_SOURCES) {
      try {
        const basePaths = this.getSourceBasePaths(sourceConfig);
        if (basePaths.length === 0 && !sourceConfig.isUserLevel) {
          continue;
        }

        for (const basePath of basePaths) {
          const skillsPath = path.join(basePath, sourceConfig.directory);

          if (!this.isDirectorySync(skillsPath)) {
            continue;
          }

          const count = await this.loadSkillsFromDirectory(skillsPath, sourceConfig.source, result);
          console.log(`[SkillsHandler] Loaded ${count} skills from ${sourceConfig.source}`);
        }
      } catch (error: any) {
        console.log(`[SkillsHandler] Failed to load from ${sourceConfig.source}:`, error?.message);
      }
    }

    result.skills = Array.from(this.skills.values());
    console.log('[SkillsHandler] Skills loaded - total:', this.skills.size);
    return result;
  }

  private getSourceBasePaths(sourceConfig: SkillSourceConfig): string[] {
    if (sourceConfig.isUserLevel) {
      return [os.homedir()];
    }
    const folders = vscode.workspace.workspaceFolders;
    return folders ? folders.map(f => f.uri.fsPath) : [];
  }

  private isDirectorySync(p: string): boolean {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  }

  private async loadSkillsFromDirectory(
    skillsPath: string,
    source: SkillSource,
    result: { skills: Skill[]; errors: { path: string; error: string }[] },
    depth: number = 0,
  ): Promise<number> {
    if (depth > SkillsHandler.MAX_SCAN_DEPTH) {
      return 0;
    }

    let loadedCount = 0;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(skillsPath, { withFileTypes: true });
    } catch {
      return 0;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      try {
        if (entry.isDirectory()) {
          const dirPath = path.join(skillsPath, entry.name);
          const skillMd = path.join(dirPath, 'SKILL.md');
          if (fs.existsSync(skillMd)) {
            const skill = await this.loadSkillFromFile(skillMd, dirPath, source);
            if (skill) {
              this.skills.set(skill.name, skill);
              loadedCount++;
            }
          } else {
            loadedCount += await this.loadSkillsFromDirectory(dirPath, source, result, depth + 1);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md') && depth === 0) {
          const filePath = path.join(skillsPath, entry.name);
          const skill = await this.loadSkillFromFile(filePath, filePath, source);
          if (skill) {
            this.skills.set(skill.name, skill);
            loadedCount++;
          }
        }
      } catch (error: any) {
        result.errors.push({
          path: path.join(skillsPath, entry.name),
          error: error?.message || 'Unknown error',
        });
      }
    }

    return loadedCount;
  }

  private async loadSkillFromFile(
    mdFilePath: string,
    skillRootPath: string,
    source: SkillSource,
  ): Promise<Skill | null> {
    try {
      const raw = await fs.promises.readFile(mdFilePath, 'utf-8');
      const parsed = parseMdc(raw);

      // 目录型 skill 用目录名，单文件 skill 用文件名（去掉 .md）
      const isDirectorySkill = mdFilePath !== skillRootPath;
      const defaultName = isDirectorySkill
        ? path.basename(path.dirname(mdFilePath))
        : path.basename(mdFilePath, '.md');

      if (!parsed.success || !parsed.metaData) {
        // Fallback: 使用默认 name
        return {
          metaData: { name: defaultName, description: '' },
          name: defaultName,
          content: raw,
          path: skillRootPath,
          source,
        };
      }

      const rawMeta = parsed.metaData;
      const userInvocableRaw = rawMeta['user-invocable'] ?? rawMeta.userInvocable;
      const alwaysApply = rawMeta.alwaysApply;
      const metaData: SkillMetaData = {
        name: rawMeta.name || defaultName,
        description: rawMeta.description || '',
        description_cn: rawMeta.description_cn,
        userInvocable: typeof userInvocableRaw === 'boolean' ? userInvocableRaw : true,
      };

      return {
        metaData,
        name: metaData.name,
        content: parsed.content || '',
        path: skillRootPath,
        source,
      };
    } catch {
      return null;
    }
  }

  // ── 文件监听 ──

  private async initializeFileWatcher(): Promise<void> {
    const { scheduleReload, dispose: disposeDebounce } = this.createDebouncedReload();
    this.disposables.push(new vscode.Disposable(disposeDebounce));

    // 轮询兜底
    this.disposables.push(this.startDirectoryPolling(scheduleReload));

    for (const sourceConfig of SKILL_SOURCES) {
      const basePaths = this.getSourceBasePaths(sourceConfig);
      if (basePaths.length === 0 && !sourceConfig.isUserLevel) {
        continue;
      }

      for (const basePath of basePaths) {
        try {
          const watchers = this.setupWatchersForSource(sourceConfig, basePath, scheduleReload);
          this.disposables.push(...watchers);
          console.log(`[SkillsHandler] Watcher initialized for ${sourceConfig.source} at ${basePath}`);
        } catch (error: any) {
          console.log(`[SkillsHandler] Watcher failed for ${sourceConfig.source}:`, error?.message);
        }
      }
    }
  }

  private setupWatchersForSource(
    sourceConfig: SkillSourceConfig,
    basePath: string,
    onChange: () => void,
  ): vscode.Disposable[] {
    const watchers: vscode.Disposable[] = [];
    const baseUri = vscode.Uri.file(basePath);

    const dirWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(baseUri, sourceConfig.directory),
    );
    dirWatcher.onDidCreate(onChange);
    dirWatcher.onDidChange(onChange);
    dirWatcher.onDidDelete(onChange);
    watchers.push(dirWatcher);

    const subDirWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(baseUri, `${sourceConfig.directory}/*`),
    );
    subDirWatcher.onDidCreate(onChange);
    subDirWatcher.onDidChange(onChange);
    subDirWatcher.onDidDelete(onChange);
    watchers.push(subDirWatcher);

    const mdWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(baseUri, `${sourceConfig.directory}/**/*.md`),
    );
    mdWatcher.onDidCreate(onChange);
    mdWatcher.onDidChange(onChange);
    mdWatcher.onDidDelete(onChange);
    watchers.push(mdWatcher);

    return watchers;
  }

  private createDebouncedReload(): { scheduleReload: () => void; dispose: () => void } {
    let timer: NodeJS.Timeout | null = null;

    const reload = async () => {
      await this.loadSkills();
      this.syncSkills();
      console.log('[SkillsHandler] Skills reloaded due to file change');
    };

    const scheduleReload = () => {
      if (timer) { clearTimeout(timer); }
      timer = setTimeout(() => {
        timer = null;
        void reload();
      }, SkillsHandler.DEBOUNCE_MS);
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

    const getContentHash = async (dirPath: string): Promise<string | null> => {
      try {
        const entries = await fs.promises.readdir(dirPath);
        return entries.sort().join(',');
      } catch {
        return null;
      }
    };

    const poll = async () => {
      if (polling) { return; }
      polling = true;
      try {
        for (const sourceConfig of SKILL_SOURCES) {
          const basePaths = this.getSourceBasePaths(sourceConfig);
          for (const basePath of basePaths) {
            const skillsPath = path.join(basePath, sourceConfig.directory);
            const hash = await getContentHash(skillsPath);
            const cached = dirContentCache.get(skillsPath);

            if (cached === undefined) {
              dirContentCache.set(skillsPath, hash ?? '');
            } else if (cached !== (hash ?? '')) {
              dirContentCache.set(skillsPath, hash ?? '');
              onDirectoryChange();
            }
          }
        }
      } finally {
        polling = false;
      }
    };

    const timer = setInterval(() => void poll(), SkillsHandler.POLL_INTERVAL_MS);
    return new vscode.Disposable(() => clearInterval(timer));
  }

  // ── syncSkills ──

  public syncSkills(): void {
    try {
      const { webviewProvider } = require('./index');
      if (webviewProvider) {
        const skills = this.getSkillIndex();
        webviewProvider.sendMessage({ type: 'SYNC_SKILLS', data: skills });
      }
    } catch (error: any) {
      console.log('[SkillsHandler] syncSkills failed:', error?.message);
    }
  }

  // ── 查询接口 ──

  public getSkillIndex(): SkillIndexItem[] {
    return Array.from(this.skills.values()).map(skill => ({
      name: skill.name,
      description: skill.metaData.description,
      description_cn: skill.metaData.description_cn,
      source: skill.source,
      path: skill.path,
      userInvocable: skill.metaData.userInvocable,
    }));
  }

  public getSkillByName(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  public getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  public get count(): number {
    return this.skills.size;
  }

  // ── activateSkill ──

  public async activateSkill(name: string): Promise<UseSkillResult> {
    const skill = this.getSkillByName(name);
    if (!skill) {
      return {
        success: false,
        error: `Skill "${name}" not found. Available: ${Array.from(this.skills.keys()).join(', ')}`,
      };
    }

    // 每次激活时重新读取文件内容
    const freshContent = await this.readSkillContentFresh(skill);

    const result: UseSkillResult = {
      success: true,
      skill: {
        name: skill.name,
        content: freshContent ?? skill.content,
        path: skill.path,
        source: skill.source,
      },
    };

    // 目录型 skill：扫描 resources
    if (this.isDirectorySkill(skill)) {
      const cwd = this.getSkillCwd(skill);
      const files = await this.getSkillResources(skill.path, cwd);
      if (files.length > 0) {
        result.skill!.resources = { cwd, files };
      }
    }

    return result;
  }

  private async readSkillContentFresh(skill: Skill): Promise<string | null> {
    try {
      const mdFilePath = this.isDirectorySkill(skill)
        ? path.join(skill.path, 'SKILL.md')
        : skill.path;

      const freshSkill = await this.loadSkillFromFile(mdFilePath, skill.path, skill.source);
      return freshSkill?.content ?? null;
    } catch (error: any) {
      console.log('[SkillsHandler] Failed to read fresh content:', error?.message);
      return null;
    }
  }

  private isDirectorySkill(skill: Skill): boolean {
    return !skill.path.toLowerCase().endsWith('.md');
  }

  private getSkillCwd(skill: Skill): string {
    if (skill.source.endsWith('-user')) {
      return os.homedir();
    }
    const folders = vscode.workspace.workspaceFolders;
    return folders?.[0]?.uri.fsPath || os.homedir();
  }

  private async getSkillResources(dirPath: string, cwd: string): Promise<string[]> {
    const resources: string[] = [];

    const scanDir = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            if (entry.name.toUpperCase() !== 'SKILL.MD') {
              resources.push(path.relative(cwd, fullPath));
            }
          }
        }
      } catch {
        // skip unreadable directories
      }
    };

    await scanDir(dirPath);
    return resources;
  }

  // ── 消息处理函数 ──

  public handleUpdateSkillConfig(data: any, context?: vscode.ExtensionContext): void {
    if (context) { this.context = context; }
    try {
      const { name, disabled } = data || {};
      if (!name) { return; }

      this.skillConfigs.set(name, { name, disabled: !!disabled });
      this.persistSkillConfigs();
      console.log(`[SkillsHandler] Updated skillConfig: ${name} disabled=${disabled}`);
    } catch (error: any) {
      console.log('[SkillsHandler] handleUpdateSkillConfig error:', error?.message);
    }
  }

  public async handleRemoveSkill(data: any): Promise<void> {
    try {
      const { name, skillPath } = data || {};
      const targetPath = skillPath || this.getSkillByName(name)?.path;
      if (!targetPath) {
        console.log('[SkillsHandler] handleRemoveSkill: skill not found');
        return;
      }

      const stat = await fs.promises.stat(targetPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(targetPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(targetPath);
      }

      console.log(`[SkillsHandler] Removed skill at: ${targetPath}`);

      // 刷新列表
      await this.loadSkills();
      this.syncSkills();
    } catch (error: any) {
      console.log('[SkillsHandler] handleRemoveSkill error:', error?.message);
    }
  }

  public async handleUploadSkill(data: any): Promise<void> {
    try {
      const { fileName, content } = data || {};
      if (!fileName || !content) {
        console.log('[SkillsHandler] handleUploadSkill: missing fileName or content');
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.log('[SkillsHandler] handleUploadSkill: no workspace folder');
        return;
      }

      const skillsDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'skills');
      await fs.promises.mkdir(skillsDir, { recursive: true });

      // base64 解码
      const buffer = Buffer.from(content, 'base64');

      if (fileName.endsWith('.zip')) {
        // 使用 jszip 解压
        try {
          const JSZip = require('jszip');
          const zip = await JSZip.loadAsync(buffer);
          const extractDir = path.join(skillsDir, path.basename(fileName, '.zip'));
          await fs.promises.mkdir(extractDir, { recursive: true });

          const entries = Object.keys(zip.files);
          for (const entryName of entries) {
            const zipEntry = zip.files[entryName];
            const targetPath = path.join(extractDir, entryName);

            if (zipEntry.dir) {
              await fs.promises.mkdir(targetPath, { recursive: true });
            } else {
              await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
              const fileContent = await zipEntry.async('nodebuffer');
              await fs.promises.writeFile(targetPath, fileContent);
            }
          }

          console.log(`[SkillsHandler] Extracted zip skill to: ${extractDir}`);
        } catch (zipErr: any) {
          console.log('[SkillsHandler] Zip extraction failed:', zipErr?.message);
          return;
        }
      } else {
        // .md 文件直接写入
        const filePath = path.join(skillsDir, fileName);
        await fs.promises.writeFile(filePath, buffer);
        console.log(`[SkillsHandler] Uploaded skill to: ${filePath}`);
      }

      // 刷新列表
      await this.loadSkills();
      this.syncSkills();
    } catch (error: any) {
      console.log('[SkillsHandler] handleUploadSkill error:', error?.message);
    }
  }

  // ── installBuiltinSkill ──

  public async installBuiltinSkill(
    skillName: string,
    downloadUrl: string,
  ): Promise<{ success: boolean; skillName?: string; installPath?: string; error?: string }> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return { success: false, error: 'No workspace folder found' };
      }

      const skillsDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'skills');
      await fs.promises.mkdir(skillsDir, { recursive: true });

      // HTTP 下载
      const buffer = await this.httpDownload(downloadUrl);

      if (downloadUrl.endsWith('.zip')) {
        // zip 解压
        try {
          const JSZip = require('jszip');
          const zip = await JSZip.loadAsync(buffer);
          const extractDir = path.join(skillsDir, skillName);
          await fs.promises.mkdir(extractDir, { recursive: true });

          const entries = Object.keys(zip.files);
          for (const entryName of entries) {
            const zipEntry = zip.files[entryName];
            const targetPath = path.join(extractDir, entryName);

            if (zipEntry.dir) {
              await fs.promises.mkdir(targetPath, { recursive: true });
            } else {
              await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
              const fileContent = await zipEntry.async('nodebuffer');
              await fs.promises.writeFile(targetPath, fileContent);
            }
          }

          console.log(`[SkillsHandler] Installed zip skill to: ${extractDir}`);

          await this.loadSkills();
          this.syncSkills();

          return {
            success: true,
            skillName,
            installPath: extractDir,
          };
        } catch (zipErr: any) {
          return { success: false, error: `Zip extraction failed: ${zipErr?.message}` };
        }
      } else {
        // 普通 .md 文件
        const filePath = path.join(skillsDir, `${skillName}.md`);
        await fs.promises.writeFile(filePath, buffer);
        console.log(`[SkillsHandler] Installed skill to: ${filePath}`);

        await this.loadSkills();
        this.syncSkills();

        return {
          success: true,
          skillName,
          installPath: `.y3maker/skills/${skillName}.md`,
        };
      }
    } catch (error: any) {
      console.log(`[SkillsHandler] installBuiltinSkill failed:`, error?.message);
      return { success: false, error: error?.message || 'Download failed' };
    }
  }

  private httpDownload(url: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const mod = url.startsWith('https') ? require('https') : require('http');
      const req = mod.get(url, { timeout: 30000 }, (res: any) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => { chunks.push(chunk); });
        res.on('end', () => { resolve(Buffer.concat(chunks)); });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    });
  }

  // ── dispose ──

  public dispose(): void {
    console.log('[SkillsHandler] Disposing resources...');

    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    this.skills.clear();
    this.skillConfigs.clear();
    this.isInitialized = false;

    SkillsHandler.instance = null;

    console.log('[SkillsHandler] Resources disposed');
  }
}

// ─────────────────────────────────────────────
//  向后兼容导出
// ─────────────────────────────────────────────

/**
 * 向后兼容的 loadSkillsFromDir 函数
 * 内部调用 SkillsHandler 的逻辑
 */
export async function loadSkillsFromDir(
  dir: string,
  source: string,
): Promise<{ name: string; description: string; content: string; source: string; path: string }[]> {
  const skills: { name: string; description: string; content: string; source: string; path: string }[] = [];
  try {
    if (!fs.existsSync(dir)) { return skills; }
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      try {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(dir, entry.name);
          const raw = await fs.promises.readFile(filePath, 'utf-8');
          const parsed = parseMdc(raw);
          const name = parsed.success && parsed.metaData?.name
            ? parsed.metaData.name
            : path.basename(entry.name, '.md');
          const description = parsed.success && parsed.metaData?.description
            ? parsed.metaData.description
            : '';
          const content = parsed.success && parsed.content != null
            ? parsed.content
            : raw;
          skills.push({ name, description, content, source, path: filePath });
        } else if (entry.isDirectory()) {
          const skillMdPath = path.join(dir, entry.name, 'SKILL.md');
          if (fs.existsSync(skillMdPath)) {
            const raw = await fs.promises.readFile(skillMdPath, 'utf-8');
            const parsed = parseMdc(raw);
            const name = parsed.success && parsed.metaData?.name
              ? parsed.metaData.name
              : entry.name;
            const description = parsed.success && parsed.metaData?.description
              ? parsed.metaData.description
              : '';
            const content = parsed.success && parsed.content != null
              ? parsed.content
              : raw;
            skills.push({ name, description, content, source, path: skillMdPath });
          }
        }
      } catch {
        // 静默跳过单个文件解析错误
      }
    }
  } catch {
    // 目录读取错误静默跳过
  }
  return skills;
}

export default SkillsHandler;
