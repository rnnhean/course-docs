#!/usr/bin/env node
/**
 * 告知型 hook ④：编辑后即时类型检查，只留该文件的错误（P17）
 *
 * 课程原话：这类 hook 不阻断，只把信息递给 Agent。
 *   "A hook does one of two things. It blocks, or it informs." —— p017 [00:53]
 *
 * 只报当前文件的错误：全仓库类型检查动辄几千行输出，全量回灌等于把上下文烧光。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

let input = {};
try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
    process.exit(0);
}

const file = input?.tool_input?.file_path ?? '';
if (!/\.(ts|tsx|mts|cts)$/.test(file)) process.exit(0);

const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');

try {
    const out = execFileSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
        stdio: 'pipe',
        shell: process.platform === 'win32',
        timeout: 3 * 60 * 1000,
        encoding: 'utf8',
    });
    void out;
    process.exit(0); // 没错误，静默
} catch (err) {
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    const mine = text
        .split('\n')
        .filter((l) => l.startsWith(rel) || l.includes(`\\${rel.replace(/\//g, '\\')}`))
        .slice(0, 40)
        .join('\n');
    if (!mine) process.exit(0);
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: `刚编辑的 ${rel} 有类型错误：\n${mine}`,
        },
    }));
    process.exit(0);
}
