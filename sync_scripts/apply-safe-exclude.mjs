#!/usr/bin/env node
/**
 * 类似 apply-safe.mjs，但支持 --exclude 排除指定 id。
 * 用法: node sync_scripts/apply-safe-exclude.mjs --exclude 1,19
 */
import fs from 'node:fs';
import path from 'node:path';

const REPORT = '.codemaker/sync/last-sync-report.json';
const r = JSON.parse(fs.readFileSync(REPORT, 'utf8'));

const excludeIdx = process.argv.indexOf('--exclude');
const excluded = excludeIdx >= 0
    ? new Set(process.argv[excludeIdx + 1].split(',').map(s => parseInt(s.trim())))
    : new Set();

let written = 0, skipped = 0, deleted = 0, errors = 0, excludedCount = 0;
const log = [];

for (const it of r.items) {
    if (it.category !== 'safe') continue;
    if (excluded.has(it.id)) {
        log.push(`EXCL #${it.id} ${it.local_path}`);
        excludedCount++;
        continue;
    }
    if (!it.local_path) {
        log.push(`SKIP no local_path: ${it.upstream_path}`);
        skipped++;
        continue;
    }
    const dest = path.resolve(it.local_path);
    if (it.change_type === 'deleted') {
        log.push(`DELETED (manual): ${it.local_path}`);
        deleted++;
        continue;
    }
    if (typeof it.upstream_content !== 'string') {
        log.push(`ERR no upstream_content: ${it.upstream_path}`);
        errors++;
        continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const exists = fs.existsSync(dest);
    fs.writeFileSync(dest, it.upstream_content, 'utf8');
    log.push(`${it.change_type === 'added' ? 'ADD' : 'MOD'} ${exists ? '(overwrite)' : '(new)'} #${it.id} ${it.local_path}`);
    written++;
}

console.log(log.join('\n'));
console.log(`\nDone. written=${written} excluded=${excludedCount} skipped=${skipped} deleted-pending=${deleted} errors=${errors}`);
