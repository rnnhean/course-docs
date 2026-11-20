#!/usr/bin/env node
/**
 * 告知型 hook ⑤：会话启动时加载上下文（P17）
 *
 * 课程原话：新会话不该从零开始，harness 先把「仓库现在什么样」递给 Agent：
 * git status、最近提交、以及记录决策的文件。
 *
 * 只输出摘要，不输出 diff 全文——上下文是有预算的。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const run = (cmd, args) => {
    try {
        return execFileSync(cmd, args, {
            stdio: 'pipe',
            shell: process.platform === 'win32',
            timeout: 15000,
            encoding: 'utf8',
        }).trim();
    } catch {
        return '';
    }
};

const parts = [];

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch) parts.push(`当前分支：${branch}`);

const status = run('git', ['status', '--short']).split('\n').filter(Boolean);
parts.push(status.length ? `未提交改动 ${status.length} 个文件：\n${status.slice(0, 15).join('\n')}` : '工作区干净');

const log = run('git', ['log', '--oneline', '-10']);
if (log) parts.push(`最近提交：\n${log}`);

// 决策文件：课程里叫 decisions，实际项目里用 docs/decisions.md
const decisions = path.join(process.cwd(), 'docs', 'decisions.md');
if (existsSync(decisions)) {
    const head = readFileSync(decisions, 'utf8').split('\n').slice(0, 40).join('\n');
    parts.push(`已有决策（docs/decisions.md 前 40 行）：\n${head}`);
}

if (!parts.length) process.exit(0);

process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: parts.join('\n\n'),
    },
}));
process.exit(0);
