#!/usr/bin/env node
/**
 * 应用 last-sync-report.json 中所有 SAFE 项（added/modified）。
 * - 跳过 deleted（手工处理）
 * - 跳过 REVIEW / SKIP
 * - 输出每一项操作日志
 */
import fs from 'node:fs';
import path from 'node:path';

const REPORT = '.codemaker/sync/last-sync-report.json';
const r = JSON.parse(fs.readFileSync(REPORT, 'utf8'));

let written = 0, skipped = 0, deleted = 0, errors = 0;
const log = [];

for (const it of r.items) {
    if (it.category !== 'safe') continue;
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
    log.push(`${it.change_type === 'added' ? 'ADD' : 'MOD'} ${exists ? '(overwrite)' : '(new)'} ${it.local_path}`);
    written++;
}

console.log(log.join('\n'));
console.log(`\nDone. written=${written} skipped=${skipped} deleted-pending=${deleted} errors=${errors}`);
