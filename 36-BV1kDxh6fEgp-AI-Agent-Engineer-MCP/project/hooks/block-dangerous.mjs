#!/usr/bin/env node
/**
 * 阻断型 hook ①：拦危险 shell 命令（P17）
 *
 * 课程原话：阻断时一定告诉 Agent 「该做什么」，只拦不指路等于让它反复试。
 *   "So when you block something, always tell the agent what to do instead." —— p017 [01:21]
 *
 * 输入：Claude Code 通过 stdin 传 JSON（tool_name / tool_input）
 * 输出：{"hookSpecificOutput": {...}} 阻断，或不输出任何东西（不消耗上下文）
 */
import { readFileSync } from 'node:fs';

const DANGEROUS = [
    { re: /rm\s+-rf\s+(?!\S*node_modules)/i, why: '删除目录树的命令' },
    { re: /git\s+push\s+(--force|-f)\b/i, why: 'force push 会改写远端历史' },
    { re: /drop\s+(database|table)\b/i, why: '删库/删表' },
    { re: /git\s+reset\s+--hard\b/i, why: '硬重置会丢弃未提交改动' },
];

let raw = '';
try {
    raw = readFileSync(0, 'utf8');
} catch {
    process.exit(0);
}

let input = {};
try {
    input = JSON.parse(raw || '{}');
} catch {
    process.exit(0);
}

const cmd = input?.tool_input?.command ?? '';
if (!cmd) process.exit(0);

const hit = DANGEROUS.find((d) => d.re.test(cmd));
if (!hit) process.exit(0);

const reason =
    `这条命令被拦截：${hit.why}。\n` +
    '替代做法：\n' +
    '- 需要撤销本地改动 → `git stash` 或 `git restore <文件>`，不要 `reset --hard`\n' +
    '- 需要推远端 → 普通 `git push`；确实要覆盖历史，先告诉用户并等他确认\n' +
    '- 需要删数据 → 用迁移脚本或带条件的 DELETE，并先在测试库验证';

process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
    },
}));
process.exit(0);
