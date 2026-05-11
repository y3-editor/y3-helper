#!/usr/bin/env node
/**
 * 对比 Y3 当前文件 vs 上游 baseline 文件 vs 上游新文件，找出 Y3 的真实定制点。
 * - 忽略 CRLF/LF 差异
 * - 用 git show <baseline-commit>:<upstream_path> 取上游 baseline
 * - 报告：Y3 定制行 (在 baseline 里没有的) + 上游本次新加 (Y3 没合)
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const REPORT = '.codemaker/sync/last-sync-report.json';
const BASELINE = '.codemaker/sync/baseline.json';
const CONFIG_LOCAL = '.codemaker/sync/config.local.json';

const r = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const configLocal = JSON.parse(fs.readFileSync(CONFIG_LOCAL, 'utf8'));

const id = parseInt(process.argv[2]);
if (!id) { console.error('usage: node analyze-review.mjs <id>'); process.exit(1); }
const it = r.items.find(x => x.id === id);
if (!it) { console.error('id not found'); process.exit(1); }

const repo = it.repo;
const repoPath = configLocal[repo].localPath;
const baseCommit = baseline[repo].lastSyncCommit;

const norm = s => s.replace(/\r\n/g, '\n');

const cur = norm(fs.readFileSync(it.local_path, 'utf8'));
const upNew = norm(it.upstream_content || '');
let upBase = '';
try {
    upBase = norm(execSync(`git -C "${repoPath}" show ${baseCommit}:${it.upstream_path}`, { encoding: 'utf8' }));
} catch (e) {
    console.error('Failed to get baseline content:', e.message);
}

const curLines = cur.split('\n');
const upBaseLines = upBase.split('\n');
const upNewLines = upNew.split('\n');

console.log(`# ${it.local_path}`);
console.log(`baseline commit: ${baseCommit}`);
console.log(`Y3 lines: ${curLines.length}, upstream-baseline lines: ${upBaseLines.length}, upstream-new lines: ${upNewLines.length}`);
console.log();

// Y3 customization: lines in cur not in upBase
const upBaseSet = new Set(upBaseLines.map(l => l.trim()).filter(l => l));
const y3Custom = curLines.filter((l, i) => l.trim() && !upBaseSet.has(l.trim()));

// Upstream new additions: lines in upNew not in upBase
const upNewAdd = upNewLines.filter(l => l.trim() && !upBaseSet.has(l.trim()));

console.log('## Y3 customization (lines in Y3 not in upstream-baseline):');
console.log(`  count: ${y3Custom.length}`);
if (y3Custom.length < 200) {
    y3Custom.forEach(l => console.log('  Y3+ ' + l));
}
console.log();
console.log('## Upstream new (lines in upstream-new not in upstream-baseline):');
console.log(`  count: ${upNewAdd.length}`);
if (upNewAdd.length < 200) {
    upNewAdd.forEach(l => console.log('  UP+ ' + l));
}
