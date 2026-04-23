/**
 * CodeMaker Upstream Sync Tool
 *
 * Phase 1: analyze — 分析上游变更，生成同步报告（含完整 diff）
 * Phase 2: merge   — 由 AI 在对话中驱动，不再使用 CMD 交互
 * Phase 3: verify  — 验证合并结果（编译检查 + 协议一致性）+ 更新基准
 *
 * Usage:
 *   npx tsx sync_scripts/sync-upstream.ts analyze [--repo webui|extension] [--skip-to-date YYYY-MM-DD]
 *   npx tsx sync_scripts/sync-upstream.ts verify
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

interface SyncConfig {
    webui: RepoConfig;
    extension: ExtensionRepoConfig;
}

interface RepoConfig {
    description: string;
    mapping: Record<string, string>;
    root_file_mapping?: Record<string, string>;
    customized: string[];
    y3_only: string[];
    excluded_upstream: string[];
}

interface ExtensionRepoConfig extends RepoConfig {
    file_mapping: Record<string, string>;
    upstream_watch: string[];
    one_to_many_mapping: Record<string, string[]>;
}

interface LocalConfig {
    webui: { repoUrl: string; localPath: string; branch: string };
    extension: { repoUrl: string; localPath: string; branch: string };
}

interface Baseline {
    webui: { lastSyncCommit: string; lastSyncDate: string };
    extension: { lastSyncCommit: string; lastSyncDate: string };
}

interface Exclusions {
    excluded_message_types: Record<string, string>;
    excluded_upstream_dirs: Record<string, string>;
}

type ChangeCategory = 'safe' | 'review' | 'new' | 'skip' | 'exists';

interface ChangeItem {
    id: number;
    category: ChangeCategory;
    repo: 'webui' | 'extension';
    upstream_path: string;
    local_path: string | null;
    change_type: 'modified' | 'added' | 'deleted' | 'renamed';
    reason: string | null;
    status: 'pending';
    diff_stat?: string;
    /** 完整 diff 内容，供 AI 读取后做合并决策 */
    diff?: string;
    /** 上游目标 commit 中该文件的完整内容 */
    upstream_content?: string;
}

interface SyncTarget {
    commit: string;
    date: string;
    message: string;
}

interface SyncReport {
    generated_at: string;
    upstream: {
        webui: { from: string; to: string; date_from: string; date_to: string; commits: number } | null;
        extension: { from: string; to: string; date_from: string; date_to: string; commits: number } | null;
    };
    items: ChangeItem[];
    message_type_changes?: {
        new_cases: string[];
        exists_cases: string[];
        skipped_cases: string[];
    };
}

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════

const SYNC_DIR = path.resolve(__dirname, '..', '.codemaker', 'sync');
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════
//  Config Loading
// ═══════════════════════════════════════════════════════════════

function loadConfig(): { config: SyncConfig; local: LocalConfig; baseline: Baseline; exclusions: Exclusions } {
    const configPath = path.join(SYNC_DIR, 'config.json');
    const localPath = path.join(SYNC_DIR, 'config.local.json');
    const baselinePath = path.join(SYNC_DIR, 'baseline.json');
    const exclusionsPath = path.join(SYNC_DIR, 'exclusions.json');

    if (!fs.existsSync(configPath)) {
        throw new Error(`配置文件不存在: ${configPath}\n请先运行配置初始化。`);
    }

    if (!fs.existsSync(localPath)) {
        console.error('❌ 本地配置文件不存在: config.local.json');
        console.error('请创建 .codemaker/sync/config.local.json，内容格式：');
        console.error(JSON.stringify({
            webui: { repoUrl: 'ssh://...', localPath: 'H:/...', branch: 'main' },
            extension: { repoUrl: 'ssh://...', localPath: 'H:/...', branch: 'main' },
        }, null, 2));
        process.exit(1);
    }

    const config: SyncConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const local: LocalConfig = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    const baseline: Baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    const exclusions: Exclusions = JSON.parse(fs.readFileSync(exclusionsPath, 'utf-8'));

    return { config, local, baseline, exclusions };
}

// ═══════════════════════════════════════════════════════════════
//  Git Helper
// ═══════════════════════════════════════════════════════════════

function git(repoPath: string, args: string): string {
    try {
        const result = execSync(`git -C "${repoPath}" ${args}`, {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
        });
        return result.trim();
    } catch (err: any) {
        throw new Error(`git 命令失败: git -C "${repoPath}" ${args}\n${err.stderr || err.message}`);
    }
}

function gitFetch(repoPath: string, branch: string): void {
    console.log(`  📡 Fetching ${repoPath} ...`);
    git(repoPath, `fetch origin ${branch}`);
}

function getCommitDate(repoPath: string, commit: string): string {
    return git(repoPath, `log -1 --format=%ai ${commit}`).split(' ')[0];
}

function getCommitShort(repoPath: string, commit: string): string {
    return git(repoPath, `log -1 --format="%h %s" ${commit}`);
}

function getHeadCommit(repoPath: string, branch: string): string {
    return git(repoPath, `rev-parse origin/${branch}`);
}

function isAncestor(repoPath: string, ancestor: string, descendant: string): boolean {
    try {
        execSync(`git -C "${repoPath}" merge-base --is-ancestor ${ancestor} ${descendant}`, {
            encoding: 'utf-8',
        });
        return true;
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Find Next Sync Target (一天限额)
// ═══════════════════════════════════════════════════════════════

function findNextSyncTarget(
    repoPath: string,
    branch: string,
    baselineCommit: string,
    baselineDate: string,
    skipToDate?: string,
): SyncTarget | null {
    const head = getHeadCommit(repoPath, branch);

    // 已追上 HEAD
    if (baselineCommit === head || isAncestor(repoPath, head, baselineCommit)) {
        return null;
    }

    // 从 baseline 日期的下一天开始找
    const startDate = skipToDate || nextDay(baselineDate);

    // 最多搜索 365 天
    let currentDate = startDate;
    for (let i = 0; i < 365; i++) {
        const nextDate = nextDay(currentDate);

        // 找 currentDate ~ nextDate 之间的最后一个 commit（在 baseline 之后）
        const commits = git(
            repoPath,
            `log origin/${branch} --after="${currentDate}T00:00:00" --before="${nextDate}T00:00:00" --format="%H" --reverse`
        ).split('\n').filter(Boolean);

        if (commits.length > 0) {
            // 取该天的最后一个 commit
            const targetCommit = commits[commits.length - 1];

            // 确保 target 在 baseline 之后
            if (isAncestor(repoPath, baselineCommit, targetCommit) && targetCommit !== baselineCommit) {
                const message = getCommitShort(repoPath, targetCommit);
                return {
                    commit: targetCommit,
                    date: currentDate,
                    message,
                };
            }
        }

        currentDate = nextDate;

        // 如果已经超过今天，停止
        const today = new Date().toISOString().split('T')[0];
        if (currentDate > today) {
            break;
        }
    }

    // 兜底：如果按天找不到，直接取 baseline 后的第一个 commit
    const firstAfter = git(
        repoPath,
        `log origin/${branch} --format="%H" ${baselineCommit}..origin/${branch} --reverse`
    ).split('\n').filter(Boolean);

    if (firstAfter.length > 0) {
        const target = firstAfter[0];
        const date = getCommitDate(repoPath, target);
        const message = getCommitShort(repoPath, target);
        return { commit: target, date, message };
    }

    return null;
}

function nextDay(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Get Diff Files
// ═══════════════════════════════════════════════════════════════

interface DiffFile {
    status: 'A' | 'M' | 'D' | 'R';
    path: string;
    oldPath?: string; // for renames
}

function getDiffFiles(repoPath: string, fromCommit: string, toCommit: string): DiffFile[] {
    const raw = git(repoPath, `diff --name-status ${fromCommit}..${toCommit}`);
    if (!raw) return [];

    return raw.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t');
        const status = parts[0].charAt(0) as DiffFile['status'];

        if (status === 'R') {
            return { status, path: parts[2], oldPath: parts[1] };
        }
        return { status, path: parts[1] };
    });
}

function statusToChangeType(status: DiffFile['status']): ChangeItem['change_type'] {
    switch (status) {
        case 'A': return 'added';
        case 'M': return 'modified';
        case 'D': return 'deleted';
        case 'R': return 'renamed';
        default: return 'modified';
    }
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Classify Changes
// ═══════════════════════════════════════════════════════════════

function classifyWebuiChange(
    file: DiffFile,
    config: RepoConfig,
    exclusions: Exclusions,
): { category: ChangeCategory; localPath: string | null; reason: string | null } {
    const upPath = file.path;

    // 1. SKIP: 在 excluded_upstream 中
    if (matchesAnyPrefix(upPath, config.excluded_upstream)) {
        return { category: 'skip', localPath: null, reason: '在排除列表中' };
    }

    // 1b. SKIP: 在 exclusions.excluded_upstream_dirs 中
    const excludedDirs = Object.keys(exclusions.excluded_upstream_dirs || {});
    if (excludedDirs.some(dir => upPath.startsWith(dir))) {
        const matchedDir = excludedDirs.find(dir => upPath.startsWith(dir))!;
        return { category: 'skip', localPath: null, reason: exclusions.excluded_upstream_dirs[matchedDir] };
    }

    // 2. 尝试映射
    let localPath: string | null = null;

    // 2a. root_file_mapping
    if (config.root_file_mapping && config.root_file_mapping[upPath]) {
        localPath = config.root_file_mapping[upPath];
    }

    // 2b. directory mapping
    if (!localPath) {
        for (const [upPrefix, localPrefix] of Object.entries(config.mapping || {})) {
            if (upPath.startsWith(upPrefix)) {
                const relative = upPath.slice(upPrefix.length);
                localPath = localPrefix + relative;
                break;
            }
        }
    }

    if (!localPath) {
        return { category: 'new', localPath: null, reason: '无路径映射' };
    }

    // 3. 检查是否在 y3_only 目录中（上游改了但 Y3 有自己的版本，不需要处理）
    if (matchesAnyPrefix(localPath, config.y3_only)) {
        return { category: 'skip', localPath, reason: 'Y3独有文件' };
    }

    // 4. REVIEW: 在 customized 列表中
    if (matchesAnyPrefix(localPath, config.customized)) {
        return { category: 'review', localPath, reason: 'Y3有定制修改' };
    }

    // 5. SAFE
    return { category: 'safe', localPath, reason: null };
}

function classifyExtensionChange(
    file: DiffFile,
    config: ExtensionRepoConfig,
    exclusions: Exclusions,
): { category: ChangeCategory; localPath: string | null; reason: string | null } {
    const upPath = file.path;

    // 1. SKIP: 在 excluded_upstream 中
    if (matchesAnyPrefix(upPath, config.excluded_upstream)) {
        return { category: 'skip', localPath: null, reason: '在排除列表中' };
    }

    // 1b. SKIP: 在 exclusions.excluded_upstream_dirs 中
    const excludedDirs = Object.keys(exclusions.excluded_upstream_dirs || {});
    if (excludedDirs.some(dir => upPath.startsWith(dir))) {
        const matchedDir = excludedDirs.find(dir => upPath.startsWith(dir))!;
        return { category: 'skip', localPath: null, reason: exclusions.excluded_upstream_dirs[matchedDir] };
    }

    // 2. 检查 one_to_many_mapping
    if (config.one_to_many_mapping && config.one_to_many_mapping[upPath]) {
        // 这类映射总是 REVIEW，因为 Y3 拆分了文件
        const targets = config.one_to_many_mapping[upPath];
        return {
            category: 'review',
            localPath: targets.join(' + '),
            reason: `上游单文件映射到 Y3 的 ${targets.length} 个文件 (1:N 映射)`,
        };
    }

    // 3. 检查 upstream_watch（需要关注但不直接映射）
    if (matchesAnyPrefix(upPath, config.upstream_watch)) {
        // 查看是否也有 file_mapping
        if (config.file_mapping && config.file_mapping[upPath]) {
            return {
                category: 'review',
                localPath: config.file_mapping[upPath],
                reason: '在监控列表中且有映射',
            };
        }
        return {
            category: 'review',
            localPath: null,
            reason: '在监控列表中（可能影响 Y3Maker 功能）',
        };
    }

    // 4. 尝试 file_mapping
    if (config.file_mapping && config.file_mapping[upPath]) {
        const localPath = config.file_mapping[upPath];

        // 4a. 检查是否在 customized 中
        if (matchesAnyPrefix(localPath, config.customized)) {
            return { category: 'review', localPath, reason: 'Y3有定制修改' };
        }

        return { category: 'safe', localPath, reason: null };
    }

    // 5. 尝试 directory mapping
    for (const [upPrefix, localPrefix] of Object.entries(config.mapping || {})) {
        if (upPath.startsWith(upPrefix)) {
            const relative = upPath.slice(upPrefix.length);
            const localPath = localPrefix + relative;

            if (matchesAnyPrefix(localPath, config.customized)) {
                return { category: 'review', localPath, reason: 'Y3有定制修改' };
            }
            return { category: 'safe', localPath, reason: null };
        }
    }

    // 6. NEW: 不在任何映射中
    return { category: 'new', localPath: null, reason: '无路径映射' };
}

function matchesAnyPrefix(filepath: string, prefixes: string[]): boolean {
    return prefixes.some(prefix => {
        if (prefix.endsWith('/')) {
            return filepath.startsWith(prefix) || filepath === prefix.slice(0, -1);
        }
        return filepath === prefix || filepath.startsWith(prefix + '/');
    });
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Message Type Change Detection
// ═══════════════════════════════════════════════════════════════

function extractCasesFromDiff(repoPath: string, fromCommit: string, toCommit: string, filePath: string): {
    added: string[];
    removed: string[];
} {
    let diff: string;
    try {
        diff = git(repoPath, `diff ${fromCommit}..${toCommit} -- "${filePath}"`);
    } catch {
        return { added: [], removed: [] };
    }

    const casePattern = /case\s+['"]([\w_]+)['"]/;
    const added: string[] = [];
    const removed: string[] = [];

    for (const line of diff.split('\n')) {
        const match = casePattern.exec(line);
        if (!match) continue;

        if (line.startsWith('+') && !line.startsWith('+++')) {
            added.push(match[1]);
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            removed.push(match[1]);
        }
    }

    return {
        added: [...new Set(added)],
        removed: [...new Set(removed)],
    };
}

function getY3MakerCases(): string[] {
    const handlersPath = path.join(PROJECT_ROOT, 'src', 'codemaker', 'messageHandlers.ts');
    if (!fs.existsSync(handlersPath)) return [];

    const content = fs.readFileSync(handlersPath, 'utf-8');
    const casePattern = /case\s+['"]([\w_]+)['"]/g;
    const cases: string[] = [];
    let match;
    while ((match = casePattern.exec(content)) !== null) {
        cases.push(match[1]);
    }
    return [...new Set(cases)];
}

function detectMessageTypeChanges(
    repoPath: string,
    fromCommit: string,
    toCommit: string,
    exclusions: Exclusions,
): { new_cases: string[]; exists_cases: string[]; skipped_cases: string[] } {
    const webviewProviderPath = 'src/provider/webviewProvider/index.ts';
    const { added } = extractCasesFromDiff(repoPath, fromCommit, toCommit, webviewProviderPath);

    if (added.length === 0) {
        return { new_cases: [], exists_cases: [], skipped_cases: [] };
    }

    const y3Cases = getY3MakerCases();
    const excludedTypes = Object.keys(exclusions.excluded_message_types);

    const new_cases: string[] = [];
    const exists_cases: string[] = [];
    const skipped_cases: string[] = [];

    for (const c of added) {
        if (excludedTypes.includes(c)) {
            skipped_cases.push(c);
        } else if (y3Cases.includes(c)) {
            exists_cases.push(c);
        } else {
            new_cases.push(c);
        }
    }

    return { new_cases, exists_cases, skipped_cases };
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Git Helpers for Diff Content
// ═══════════════════════════════════════════════════════════════

function getFileDiffSafe(repoPath: string, fromCommit: string, toCommit: string, filePath: string): string | undefined {
    try {
        const result = git(repoPath, `diff ${fromCommit}..${toCommit} -- "${filePath}"`);
        return result || undefined;
    } catch {
        return undefined;
    }
}

function getFileContentAtCommitSafe(repoPath: string, commit: string, filePath: string): string | undefined {
    try {
        return git(repoPath, `show ${commit}:"${filePath}"`);
    } catch {
        return undefined;
    }
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Report Generation
// ═══════════════════════════════════════════════════════════════

function generateJsonReport(report: SyncReport): void {
    const outPath = path.join(SYNC_DIR, 'last-sync-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`  📄 JSON 报告: ${outPath}`);
}

function generateMarkdownReport(report: SyncReport): void {
    const lines: string[] = [];
    lines.push('# CodeMaker 同步报告');
    lines.push(`- 生成时间: ${report.generated_at}`);

    if (report.upstream.webui) {
        const w = report.upstream.webui;
        lines.push(`- 上游 webui: \`${w.from.slice(0, 8)}\` → \`${w.to.slice(0, 8)}\` (${w.date_from} → ${w.date_to}, ${w.commits} commits)`);
    }
    if (report.upstream.extension) {
        const e = report.upstream.extension;
        lines.push(`- 上游 extension: \`${e.from.slice(0, 8)}\` → \`${e.to.slice(0, 8)}\` (${e.date_from} → ${e.date_to}, ${e.commits} commits)`);
    }

    if (!report.upstream.webui && !report.upstream.extension) {
        lines.push('');
        lines.push('✅ 两个仓库都已是最新版本，无需同步。');
        const outPath = path.join(SYNC_DIR, 'last-sync-report.md');
        fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
        console.log(`  📄 MD 报告: ${outPath}`);
        return;
    }

    lines.push('');

    // 统计
    const safe = report.items.filter(i => i.category === 'safe');
    const review = report.items.filter(i => i.category === 'review');
    const newItems = report.items.filter(i => i.category === 'new');
    const skip = report.items.filter(i => i.category === 'skip');
    const exists = report.items.filter(i => i.category === 'exists');

    lines.push('## 📊 概览');
    lines.push('| 分类 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| 🟢 SAFE (可直接覆盖) | ${safe.length} |`);
    lines.push(`| 🟡 REVIEW (需对比决策) | ${review.length} |`);
    lines.push(`| 🔴 NEW (新增功能) | ${newItems.length} |`);
    lines.push(`| ⏭️ EXISTS (已有实现) | ${exists.length} |`);
    lines.push(`| ⚪ SKIP (已排除) | ${skip.length} |`);
    lines.push(`| 合计 | ${report.items.length} |`);
    lines.push('');

    // SAFE
    if (safe.length > 0) {
        lines.push('## 🟢 SAFE - 可直接覆盖');
        lines.push('| # | 仓库 | 上游文件 | Y3文件 | 变更类型 |');
        lines.push('|---|------|---------|--------|---------|');
        for (const item of safe) {
            lines.push(`| ${item.id} | ${item.repo} | ${item.upstream_path} | ${item.local_path} | ${item.change_type} |`);
        }
        lines.push('');
    }

    // REVIEW
    if (review.length > 0) {
        lines.push('## 🟡 REVIEW - 需对比决策');
        lines.push('| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 |');
        lines.push('|---|------|---------|--------|------|---------|');
        for (const item of review) {
            lines.push(`| ${item.id} | ${item.repo} | ${item.upstream_path} | ${item.local_path || '-'} | ${item.reason} | ${item.change_type} |`);
        }
        lines.push('');
    }

    // NEW
    if (newItems.length > 0) {
        lines.push('## 🔴 NEW - 新增功能');
        lines.push('| # | 仓库 | 上游文件 | 变更类型 |');
        lines.push('|---|------|---------|---------|');
        for (const item of newItems) {
            lines.push(`| ${item.id} | ${item.repo} | ${item.upstream_path} | ${item.change_type} |`);
        }
        lines.push('');
    }

    // Message type changes
    if (report.message_type_changes) {
        const mtc = report.message_type_changes;
        if (mtc.new_cases.length > 0 || mtc.exists_cases.length > 0 || mtc.skipped_cases.length > 0) {
            lines.push('## 📨 消息类型变更');
            if (mtc.new_cases.length > 0) {
                lines.push(`### 🔴 新增 (Y3未实现): ${mtc.new_cases.join(', ')}`);
            }
            if (mtc.exists_cases.length > 0) {
                lines.push(`### ⏭️ 已有实现: ${mtc.exists_cases.join(', ')}`);
            }
            if (mtc.skipped_cases.length > 0) {
                lines.push(`### ⚪ 已排除: ${mtc.skipped_cases.join(', ')}`);
            }
            lines.push('');
        }
    }

    // SKIP
    if (skip.length > 0) {
        lines.push('<details>');
        lines.push('<summary>⚪ SKIP - 已排除 (' + skip.length + ' 项)</summary>');
        lines.push('');
        lines.push('| # | 仓库 | 上游文件 | 原因 |');
        lines.push('|---|------|---------|------|');
        for (const item of skip) {
            lines.push(`| ${item.id} | ${item.repo} | ${item.upstream_path} | ${item.reason} |`);
        }
        lines.push('');
        lines.push('</details>');
        lines.push('');
    }

    const outPath = path.join(SYNC_DIR, 'last-sync-report.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`  📄 MD 报告: ${outPath}`);
}

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Analyze (main entry)
// ═══════════════════════════════════════════════════════════════

function analyze(skipToDate?: string, repoFilter?: 'webui' | 'extension'): void {
    console.log('═══════════════════════════════════════════');
    console.log('  Phase 1: ANALYZE - 上游变更分析');
    console.log('═══════════════════════════════════════════');
    console.log('');

    const { config, local, baseline, exclusions } = loadConfig();

    // Fetch 仓库（只 fetch 需要的）
    console.log('📡 Fetching upstream repositories...');
    if (!repoFilter || repoFilter === 'webui') {
        gitFetch(local.webui.localPath, local.webui.branch);
    }
    if (!repoFilter || repoFilter === 'extension') {
        gitFetch(local.extension.localPath, local.extension.branch);
    }
    console.log('');

    // Find sync targets
    console.log('🔍 Finding sync targets (一天限额)...');
    console.log('');

    const webuiTarget = (!repoFilter || repoFilter === 'webui')
        ? findNextSyncTarget(
            local.webui.localPath,
            local.webui.branch,
            baseline.webui.lastSyncCommit,
            baseline.webui.lastSyncDate,
            skipToDate,
        )
        : null;

    const extTarget = (!repoFilter || repoFilter === 'extension')
        ? findNextSyncTarget(
            local.extension.localPath,
            local.extension.branch,
            baseline.extension.lastSyncCommit,
            baseline.extension.lastSyncDate,
            skipToDate,
        )
        : null;

    // ── 自动选择仓库 ──
    // 不指定 --repo 时，按同一天约束自动选优先级：webui 优先
    let selectedRepo: 'webui' | 'extension' | 'none' = 'none';

    if (repoFilter) {
        // 用户明确指定了仓库
        if (repoFilter === 'webui' && webuiTarget) {
            selectedRepo = 'webui';
        } else if (repoFilter === 'extension' && extTarget) {
            selectedRepo = 'extension';
        }
    } else {
        // 自动选择：基于同一天约束
        if (webuiTarget && extTarget) {
            // 两个都有更新，看日期是否相同
            if (webuiTarget.date === extTarget.date) {
                // 同一天，但分开处理：先 webui
                selectedRepo = 'webui';
                console.log(`  ℹ️ 两个仓库在 ${webuiTarget.date} 都有更新，按优先级先处理 webui`);
                console.log(`     处理完 webui 后再执行一次 analyze 处理 extension`);
            } else if (webuiTarget.date < extTarget.date) {
                // webui 日期更早，先处理
                selectedRepo = 'webui';
            } else {
                // extension 日期更早，先处理
                selectedRepo = 'extension';
            }
        } else if (webuiTarget) {
            selectedRepo = 'webui';
        } else if (extTarget) {
            selectedRepo = 'extension';
        }
    }

    // 打印状态
    if (webuiTarget) {
        const marker = (selectedRepo === 'webui') ? '📦' : '⏸️';
        console.log(`  ${marker} webui: ${baseline.webui.lastSyncCommit.slice(0, 8)} → ${webuiTarget.commit.slice(0, 8)} (${webuiTarget.date})`);
        console.log(`     ${webuiTarget.message}`);
    } else if (!repoFilter || repoFilter === 'webui') {
        console.log('  ✅ webui: 已是最新版本');
    }

    if (extTarget) {
        const marker = (selectedRepo === 'extension') ? '📦' : '⏸️';
        console.log(`  ${marker} extension: ${baseline.extension.lastSyncCommit.slice(0, 8)} → ${extTarget.commit.slice(0, 8)} (${extTarget.date})`);
        console.log(`     ${extTarget.message}`);
    } else if (!repoFilter || repoFilter === 'extension') {
        console.log('  ✅ extension: 已是最新版本');
    }
    console.log('');

    if (selectedRepo === 'none') {
        console.log('✅ 无需同步的仓库。');
        return;
    }

    // ── 根据选择的仓库分析变更 ──
    const items: ChangeItem[] = [];
    let idCounter = 1;

    const processWebui = selectedRepo === 'webui';
    const processExtension = selectedRepo === 'extension';

    // Webui changes
    if (processWebui && webuiTarget) {
        console.log('📂 分析 webui 变更...');
        const diffs = getDiffFiles(local.webui.localPath, baseline.webui.lastSyncCommit, webuiTarget.commit);
        console.log(`  找到 ${diffs.length} 个文件变更`);

        for (const d of diffs) {
            const classification = classifyWebuiChange(d, config.webui, exclusions);
            const item: ChangeItem = {
                id: idCounter++,
                category: classification.category,
                repo: 'webui',
                upstream_path: d.path,
                local_path: classification.localPath,
                change_type: statusToChangeType(d.status),
                reason: classification.reason,
                status: 'pending',
            };

            // 为 SAFE 和 REVIEW 项填充 diff + upstream_content
            if (item.category === 'safe' || item.category === 'review') {
                item.diff = getFileDiffSafe(local.webui.localPath, baseline.webui.lastSyncCommit, webuiTarget.commit, d.path);
                if (item.change_type !== 'deleted') {
                    item.upstream_content = getFileContentAtCommitSafe(local.webui.localPath, webuiTarget.commit, d.path);
                }
            }

            items.push(item);
        }
    }

    // Extension changes
    if (processExtension && extTarget) {
        console.log('📂 分析 extension 变更...');
        const diffs = getDiffFiles(local.extension.localPath, baseline.extension.lastSyncCommit, extTarget.commit);
        console.log(`  找到 ${diffs.length} 个文件变更`);

        for (const d of diffs) {
            const classification = classifyExtensionChange(d, config.extension as ExtensionRepoConfig, exclusions);
            const item: ChangeItem = {
                id: idCounter++,
                category: classification.category,
                repo: 'extension',
                upstream_path: d.path,
                local_path: classification.localPath,
                change_type: statusToChangeType(d.status),
                reason: classification.reason,
                status: 'pending',
            };

            // 为 SAFE 和 REVIEW 项填充 diff + upstream_content
            if (item.category === 'safe' || item.category === 'review') {
                item.diff = getFileDiffSafe(local.extension.localPath, baseline.extension.lastSyncCommit, extTarget.commit, d.path);
                if (item.change_type !== 'deleted') {
                    item.upstream_content = getFileContentAtCommitSafe(local.extension.localPath, extTarget.commit, d.path);
                }
            }

            items.push(item);
        }
    }

    // Message type detection (only when processing extension)
    let messageTypeChanges: SyncReport['message_type_changes'] = undefined;
    if (processExtension && extTarget) {
        console.log('📨 检测消息类型变更...');
        messageTypeChanges = detectMessageTypeChanges(
            local.extension.localPath,
            baseline.extension.lastSyncCommit,
            extTarget.commit,
            exclusions,
        );
        if (messageTypeChanges.new_cases.length > 0) {
            console.log(`  🔴 新增消息类型: ${messageTypeChanges.new_cases.join(', ')}`);
        }
        if (messageTypeChanges.exists_cases.length > 0) {
            console.log(`  ⏭️ 已有实现: ${messageTypeChanges.exists_cases.join(', ')}`);
        }
    }
    console.log('');

    // Build report
    const report: SyncReport = {
        generated_at: new Date().toISOString(),
        upstream: {
            webui: (processWebui && webuiTarget) ? {
                from: baseline.webui.lastSyncCommit,
                to: webuiTarget.commit,
                date_from: baseline.webui.lastSyncDate,
                date_to: webuiTarget.date,
                commits: parseInt(git(local.webui.localPath, `rev-list --count ${baseline.webui.lastSyncCommit}..${webuiTarget.commit}`) || '0'),
            } : null,
            extension: (processExtension && extTarget) ? {
                from: baseline.extension.lastSyncCommit,
                to: extTarget.commit,
                date_from: baseline.extension.lastSyncDate,
                date_to: extTarget.date,
                commits: parseInt(git(local.extension.localPath, `rev-list --count ${baseline.extension.lastSyncCommit}..${extTarget.commit}`) || '0'),
            } : null,
        },
        items,
        message_type_changes: messageTypeChanges,
    };

    // Generate reports
    console.log('📝 生成同步报告...');
    generateJsonReport(report);
    generateMarkdownReport(report);

    // Summary
    const safe = items.filter(i => i.category === 'safe').length;
    const review = items.filter(i => i.category === 'review').length;
    const newCount = items.filter(i => i.category === 'new').length;
    const skipCount = items.filter(i => i.category === 'skip').length;

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log(`  分析完成! [${selectedRepo.toUpperCase()}]`);
    console.log(`  🟢 SAFE: ${safe}  🟡 REVIEW: ${review}  🔴 NEW: ${newCount}  ⚪ SKIP: ${skipCount}`);
    console.log('  总计: ' + items.length + ' 个变更项');
    console.log('');
    console.log('  下一步: 在 AI 对话中运行 Phase 2 合并');
    console.log('  或查看报告: .codemaker/sync/last-sync-report.md');

    // 提示同一天的另一个仓库
    if (!repoFilter) {
        if (selectedRepo === 'webui' && extTarget && webuiTarget && extTarget.date === webuiTarget.date) {
            console.log('');
            console.log(`  ⏳ extension 在同一天 (${extTarget.date}) 也有更新`);
            console.log('     合并完 webui 后请再次执行 analyze 处理 extension');
        } else if (selectedRepo === 'webui' && extTarget) {
            console.log('');
            console.log(`  ⏳ extension 有待处理更新 (${extTarget.date})`);
            console.log('     当前天的 webui 合并完后再处理');
        } else if (selectedRepo === 'extension' && webuiTarget) {
            console.log('');
            console.log(`  ⏳ webui 有待处理更新 (${webuiTarget.date})`);
            console.log('     当前天的 extension 合并完后再处理');
        }
    }

    console.log('═══════════════════════════════════════════');
}

// ═══════════════════════════════════════════════════════════════
//  Phase 3: Verify
// ═══════════════════════════════════════════════════════════════

function verify(): void {
    console.log('═══════════════════════════════════════════');
    console.log('  Phase 3: VERIFY - 合并验证');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('⚠️  编译验证请在终端中手动执行以下命令：');
    console.log('');
    console.log('  1. Webview 编译:');
    console.log('     cd resources/webview_source_code && npm run build');
    console.log('');
    console.log('  2. Extension 编译:');
    console.log('     npm run compile');
    console.log('');
    console.log('  确认编译通过后，再运行:');
    console.log('     npm run sync:verify -- --confirm');
    console.log('');
    console.log('═══════════════════════════════════════════');
}

function verifyConfirm(): void {
    console.log('═══════════════════════════════════════════');
    console.log('  Phase 3: VERIFY - 更新基准');
    console.log('═══════════════════════════════════════════');
    console.log('');

    // 1. 消息协议一致性校验
    console.log('📨 检查消息协议一致性...');
    const y3Cases = getY3MakerCases();
    console.log(`  后端处理的消息类型: ${y3Cases.length} 个`);
    console.log('  ✅ 消息类型清单已记录 (详细校验需结合前端)');

    // 2. 更新基准
    console.log('');
    console.log('📌 更新基准版本...');

    const reportPath = path.join(SYNC_DIR, 'last-sync-report.json');
    if (fs.existsSync(reportPath)) {
        const report: SyncReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        const baselinePath = path.join(SYNC_DIR, 'baseline.json');
        const baseline: Baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

        if (report.upstream.webui) {
            baseline.webui.lastSyncCommit = report.upstream.webui.to;
            baseline.webui.lastSyncDate = report.upstream.webui.date_to;
            console.log(`  webui: → ${report.upstream.webui.to.slice(0, 8)} (${report.upstream.webui.date_to})`);
        }
        if (report.upstream.extension) {
            baseline.extension.lastSyncCommit = report.upstream.extension.to;
            baseline.extension.lastSyncDate = report.upstream.extension.date_to;
            console.log(`  extension: → ${report.upstream.extension.to.slice(0, 8)} (${report.upstream.extension.date_to})`);
        }

        fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf-8');
        console.log('  ✅ baseline.json 已更新');

        // 3. 写同步总结到 history
        writeHistory(report);
    } else {
        console.log('  ⚠️ 未找到同步报告，跳过基准更新');
    }

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  ✅ 基准已更新，可以运行下一轮 analyze。');
    console.log('═══════════════════════════════════════════');
}

function writeHistory(report: SyncReport): void {
    const historyDir = path.join(SYNC_DIR, 'history');
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');

    // 文件名: 2026-04-23_1430.md
    const filename = `${dateStr}_${timeStr}.md`;
    const filePath = path.join(historyDir, filename);

    // 统计
    const safe = report.items.filter(i => i.category === 'safe');
    const review = report.items.filter(i => i.category === 'review');
    const newItems = report.items.filter(i => i.category === 'new');
    const skip = report.items.filter(i => i.category === 'skip');

    const lines: string[] = [];
    lines.push(`# 同步总结 ${dateStr}`);
    lines.push('');
    lines.push(`> 生成时间: ${now.toISOString()}`);
    lines.push('');

    // 上游范围
    lines.push('## 上游范围');
    lines.push('');
    if (report.upstream.webui) {
        const w = report.upstream.webui;
        lines.push(`- **webui**: \`${w.from.slice(0, 8)}\` → \`${w.to.slice(0, 8)}\` (${w.date_from} → ${w.date_to}), ${w.commits} commits`);
    }
    if (report.upstream.extension) {
        const e = report.upstream.extension;
        lines.push(`- **extension**: \`${e.from.slice(0, 8)}\` → \`${e.to.slice(0, 8)}\` (${e.date_from} → ${e.date_to}), ${e.commits} commits`);
    }
    lines.push('');

    // 统计概览
    lines.push('## 统计');
    lines.push('');
    lines.push(`| 分类 | 数量 |`);
    lines.push(`|------|------|`);
    lines.push(`| 🟢 SAFE | ${safe.length} |`);
    lines.push(`| 🟡 REVIEW | ${review.length} |`);
    lines.push(`| 🔴 NEW | ${newItems.length} |`);
    lines.push(`| ⚪ SKIP | ${skip.length} |`);
    lines.push(`| **总计** | **${report.items.length}** |`);
    lines.push('');

    // 详细变更列表（SAFE + REVIEW + NEW）
    const actionable = report.items.filter(i => i.category !== 'skip');
    if (actionable.length > 0) {
        lines.push('## 变更明细');
        lines.push('');
        lines.push('| # | 分类 | 仓库 | 上游路径 | Y3 路径 | 类型 |');
        lines.push('|---|------|------|---------|---------|------|');
        for (const item of actionable) {
            const icon = item.category === 'safe' ? '🟢' : item.category === 'review' ? '🟡' : '🔴';
            lines.push(`| ${item.id} | ${icon} ${item.category.toUpperCase()} | ${item.repo} | \`${item.upstream_path}\` | ${item.local_path ? `\`${item.local_path}\`` : '-'} | ${item.change_type} |`);
        }
        lines.push('');
    }

    // 跳过的项（折叠）
    if (skip.length > 0) {
        lines.push('<details>');
        lines.push(`<summary>跳过项 (${skip.length} 个)</summary>`);
        lines.push('');
        for (const item of skip) {
            lines.push(`- \`${item.upstream_path}\` — ${item.reason || '在排除列表中'}`);
        }
        lines.push('');
        lines.push('</details>');
        lines.push('');
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log('');
    console.log(`📝 同步总结已写入: .codemaker/sync/history/${filename}`);
}

// ═══════════════════════════════════════════════════════════════
//  CLI Entry
// ═══════════════════════════════════════════════════════════════

function main(): void {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'analyze': {
            const skipIdx = args.indexOf('--skip-to-date');
            const skipToDate = skipIdx >= 0 ? args[skipIdx + 1] : undefined;
            const repoIdx = args.indexOf('--repo');
            const repoFilter = repoIdx >= 0 ? args[repoIdx + 1] as 'webui' | 'extension' : undefined;
            if (repoFilter && repoFilter !== 'webui' && repoFilter !== 'extension') {
                console.error(`❌ --repo 参数只接受 webui 或 extension，收到: ${repoFilter}`);
                process.exit(1);
            }
            analyze(skipToDate, repoFilter);
            break;
        }
        case 'verify': {
            const hasConfirm = args.includes('--confirm');
            if (hasConfirm) {
                verifyConfirm();
            } else {
                verify();
            }
            break;
        }
        default:
            console.log('Usage:');
            console.log('  npx tsx sync_scripts/sync-upstream.ts analyze [--repo webui|extension] [--skip-to-date YYYY-MM-DD]');
            console.log('  npx tsx sync_scripts/sync-upstream.ts verify');
            console.log('');
            console.log('Phase 2 (merge) 由 AI 在对话中驱动，无需命令行。');
            console.log('请在 AI 对话中说："帮我合并上游同步报告" 或 "读取同步报告开始合并"');
            process.exit(1);
    }
}

main();
